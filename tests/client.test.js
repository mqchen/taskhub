const test = require('ava');
const Client = require('../client');
const Server = require('../server');

async function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(() => resolve(), ms);
  });
}

async function createClient(t) {
  const client = await Client.create(
    `ws://localhost:${t.context.hub.address.port}`,
    t.context.serviceName,
    t.context.creds.key);
  client.logger = { ...client.logger,
    log: () => {},
    info: () => {} }; // Mute log
  return client;
}

test.beforeEach(async (t) => {
  t.context.hub = new Server({ port: 0 });
  t.context.hub.logger = { ...t.context.hub.logger,
    log: () => {},
    info: () => {} }; // Mute log
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

test('Basic task posting without expecting anything', async (t) => {
  const client = t.context.client;
  const task = client.pub('a-service:test-action', { thisIsThePayload: 'some data' });
  t.true(task instanceof Client.Task);
});

test('Subs should be called on Pubs', async (t) => {
  t.plan(2);
  const client = t.context.client;
  client.sub('test:action', () => t.pass('Called'));
  client.sub('test:action', () => t.pass('Also called'));
  client.sub('test:action', () => {}); // Noop
  client.sub('test:another-action', () => t.fail('Should not be called'));
  client.pub('test:action');
  await wait(50); // wait for it to get a change to run
});

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
