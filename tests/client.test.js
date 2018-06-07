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
Server.defaultLogger = Client.defaultLogger;


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

test('Publish new task', async (t) => {
  t.plan(4);
  const client = t.context.client;
  const payload = { a: 'payload here' };
  const action = `action_${Math.random()}`;
  const task = await client.pub(action, payload);
  task.on('init', () => { t.pass('Task created = task initialized. Initialized event should have occurred.'); });
  task.on('start', () => { t.fail('Creating task does not mean it has started.'); });
  t.is(task.action, action);
  t.deepEqual(await task.getPayload(), payload);
  t.is(task.state, 'init');
});

// test('Basic task posting without expecting anything', async (t) => {
//   const client = t.context.client;
//   const payload = { thisIsThePayload: 'some data' };
//   const task = client.pub('a-service:test-action', payload);
//   t.is(async task.getPayload(), payload);
// });
//
// test('Subs should be called on Pubs', async (t) => {
//   t.plan(2);
//   const client = t.context.client;
//   client.sub('test:action', () => t.pass('Called'));
//   client.sub('test:action', () => t.pass('Also called'));
//   client.sub('test:action', () => {}); // Noop
//   client.sub('test:another-action', () => t.fail('Should not be called'));
//   client.pub('test:action');
//   await wait(50); // wait for it to get a change to run
// });

// test('Post task and get reply', async (t) => {
//   const client = t.context.client;
//
//   const result = `result_${Math.random()}`;
//   client.sub('test:test', () => result); // This service only replies with static result.
//   const task = client.pub('test:test', {});
//
//   await wait(50);
//
//   const response = await task.getResult();
//   t.is(response, result);
// });
