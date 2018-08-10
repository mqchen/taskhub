const test = require('ava');
const winston = require('winston');
const Client = require('../client');
const Server = require('../server');

async function wait(ms) {
  return new Promise((resolve) => { setTimeout(() => resolve(), ms); });
}

Client.defaultLogger = new winston.Logger({
  level: 'debug',
  transports: [new (winston.transports.Console)()]
});
Client.defaultLogger.cli();

Server.defaultLogger = new winston.Logger({
  level: 'debug',
  transports: [new (winston.transports.Console)()]
});
Server.defaultLogger.cli();


async function createClient(t) {
  const client = await Client.create(
    `ws://localhost:${t.context.hub.address.port}`,
    t.context.serviceName,
    t.context.creds.key);
  return client;
}

test.beforeEach(async (t) => {
  t.context.hub = new Server({ port: 0 });
  t.context.creds = { key: `password: ${Math.random()}` };
  t.context.serviceName = `test_${Math.random()}`;
  t.context.hub.addCredential(t.context.serviceName, t.context.creds);
  t.context.hub.start();
  t.context.client = await createClient(t);
});

test.afterEach.always((t) => {
  t.context.hub.stop();
});

test('Create new Client should auto connect', async (t) => {
  t.true(t.context.client.isOpen());
});

test('Publish new task and go through lifecycle', async (t) => {
  t.plan(9);
  const client = t.context.client;
  const payload = { a: 'payload here' };
  const action = `action_${Math.random()}`;
  const task = await client.pub(action, payload);
  task.on('init', async (paramTask) => {
    t.pass(t.deepEqual(await paramTask.getPayload(), payload)); // counts as 2 assertions...
    t.pass('Task created = initialized. Initialized event should have occurred.');
  });
  const shouldNotStartNow = () => { t.fail('Creating task does not mean it has started.'); };
  task.on('start', shouldNotStartNow);

  t.is(task.action, action);
  t.deepEqual(await task.getPayload(), payload);
  t.is(task.state, 'init');

  // Start
  task.off('start', shouldNotStartNow);
  task.start();
  task.once('start', () => { t.pass(); });

  // update
  // TODO: update data should be passed to the listener
  task.on('update', () => { t.pass(); });
  task.update({ data: 'foo' });
  task.update({ data: 'bar' });

  await wait(50);
});

test('Basic task posting without expecting anything', async (t) => {
  const client = t.context.client;
  const payload = { thisIsThePayload: 'some data' };
  const task = await client.pub('a-service:test-action', payload);
  t.deepEqual(await task.getPayload(), payload);
});

test('Subs should be called on Pubs', async (t) => {
  t.plan(2);
  const client = t.context.client;
  client.sub('test:action', () => t.pass('Called'));
  client.sub('test:action', () => t.pass('Also called'));
  client.sub('test:action', () => {}); // Noop
  client.sub('test:another-action', () => t.fail('Should not be called'));
  await client.pub('test:action');
  await wait(50); // wait for it to get a change to run
});

test('Subs should be called with Task object, with access to payload.', async (t) => {
  t.plan(1);
  const client = t.context.client;
  const payload = { thisIsThePayload: 'some data', random: Math.random() };

  client.sub('test:action', async (task) => {
    t.deepEqual(await task.getPayload(), payload);
  });
  await client.pub('test:action', payload);
  await wait(50);
});

test('Post task that succeeds should return result', async (t) => {
  const client = t.context.client;

  const result = `result_${Math.random()}`;
  client.sub('test:test', task => task.success(result)); // This service only replies with static result.

  // const response = await (await client.pub('test:test')).getResult();
  const response = await client.pub('test:test').then(x => x.getResult());
  // TODO: support for: const response = await client.pub('test:test').getResult();

  t.is(response, result);
});

test('When tasks fails it should provide reason', async (t) => {
  t.plan(1);
  const client = t.context.client;

  client.sub('test:test', task => task.fail('some reason'));

  const task = await client.pub('test:test');
  task.on('fail', async tt => t.is(await tt.getReason(), 'some reason'));
  await wait(10);
});
