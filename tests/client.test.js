const test = require('ava');
const winston = require('winston');
const getPort = require('get-port');
const Client = require('../client');
const Server = require('../server');
const wait = require('../common/wait');

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'debug',
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});
Server.defaultLogger = logger;
Client.defaultLogger = logger;

async function createClient(t) {
  const client = await Client.create({
    url: `ws://localhost:${t.context.hub.address.port}`,
    clientName: t.context.clientName,
    key: t.context.creds.key,
    timeout: t.context.timeout
  });
  return client;
}

test.beforeEach(async (t) => {
  t.context.hub = new Server({ port: await getPort() });
  t.context.creds = { key: `password_${Math.random()}` };
  t.context.clientName = `test_${Math.random()}`;
  t.context.timeout = 100;
  t.context.hub.addCredentials(t.context.clientName, t.context.creds);
  t.context.hub.start();
  t.context.client = await createClient(t);
});

test.afterEach.always((t) => {
  t.context.hub.stop();
});

test('Create new Client should auto connect', async (t) => {
  t.true(t.context.client.isOpen());
});

test('Create new Client should try to reconnect until timeout', async (t) => {
  t.plan(1);
  // create own server and client
  const port = await getPort();
  const hub = new Server({ port });
  const creds = { key: `password_${Math.random()}` };
  const clientName = `test_${Math.random()}`;
  hub.addCredentials(clientName, creds);
  try {
    const out = await Promise.all([
      Client.create({
        url: `ws://localhost:${port}`,
        clientName,
        key: creds.key,
        timeout: 5000
      },
      new Promise((resolve) => {
        // Start hub after client tries to connect
        setTimeout(() => resolve(hub.start()), 500);
      }))
    ]);
    t.true(out[0].isOpen(), 'Client should be open now');
  } catch (e) {
    t.fail(e.message);
  }
});

test('Publish new task and go through lifecycle', async (t) => {
  t.plan(11);
  const { client } = t.context;
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

  // Update
  const update1 = { a: 'foo' };
  task.once('update', (tt) => { t.deepEqual(update1, tt.getLastUpdate()); });
  task.update(update1);

  const update2 = { b: 'bar' };
  task.once('update', (tt) => { t.deepEqual(update1, tt.getLastUpdate()); });
  task.update(update2);

  // Success & End
  const successResult = { foo: Math.random(), bar: new Date().getTime() };
  task.once('success', async (tt) => { t.deepEqual(successResult, await tt.getResult()); });
  task.once('end', async (tt) => { t.deepEqual(successResult, await tt.getResult()); });
  task.success(successResult);

  await wait(200);
});

test('Basic task posting without expecting anything', async (t) => {
  const { client } = t.context;
  const payload = { thisIsThePayload: 'some data' };
  const task = await client.pub('a-service:test-action', payload);
  t.deepEqual(await task.getPayload(), payload);
});

test('Subs should be called on Pubs', async (t) => {
  t.plan(2);
  const { client } = t.context;
  client.sub('test:action', () => t.pass('Called'));
  client.sub('test:action', () => t.pass('Also called'));
  client.sub('test:action', () => {}); // Noop
  client.sub('test:another-action', () => t.fail('Should not be called'));
  await client.pub('test:action');
  await wait(100); // wait for it to get a change to run
});

test('Subs should be called with Task object, with access to payload.', async (t) => {
  t.plan(1);
  const { client } = t.context;
  const payload = { thisIsThePayload: 'some data', random: Math.random() };

  client.sub('test:action', async (task) => {
    t.deepEqual(await task.getPayload(), payload);
  });
  await client.pub('test:action', payload);
  await wait(100);
});

test('Post task that succeeds should return result', async (t) => {
  const { client } = t.context;

  const result = `result_${Math.random()}`;
  client.sub('test:test', (task) => task.success(result)); // This service only replies with static result.

  // const response = await (await client.pub('test:test')).getResult();
  const response = await client.pub('test:test').then((x) => x.getResult());
  // TODO: support for: const response = await client.pub('test:test').getResult();

  t.is(response, result);
});

test('When tasks fails it should provide reason', async (t) => {
  t.plan(1);
  const { client } = t.context;

  client.sub('test:test', (task) => task.fail('some reason'));

  const task = await client.pub('test:test');
  task.on('fail', async (tt) => t.is(await tt.getReason(), 'some reason'));
  await wait(100);
});

test('do() short-hand for pub and getResult()', async (t) => {
  const { client } = t.context;

  const result = `result_${Math.random()}`;
  client.sub('test:payload-and-rand', async (task) => {
    task.success(`${(await task.getPayload()).msg}-${result}`);
  });

  t.is(await client.do('test:payload-and-rand', { msg: 'payload' }), `payload-${result}`);
});
