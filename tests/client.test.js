const test = require('ava');
const Client = require('../client');
const Server = require('../server');

async function createClient(t) {
  return Client.create(
    `ws://localhost:${t.context.hub.address.port}`,
    t.context.serviceName,
    t.context.creds.key);
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

// test('Post task and get reply', async (t) => {
//   const client = t.context.client;
//
//   const result = `result_${Math.random()}`;
//   client.sub('test:test', () => result); // This service only replies with static result.
//
//   const response = await client.pub('test:test', { thisIsThePayload: 'some data' }).getResult();
//   t.is(response, result);
// });
