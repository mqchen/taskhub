const test = require('ava');
const Client = require('../client');
const Server = require('../server');

test.beforeEach((t) => {
  t.context.hub = new Server({ port: 0 });
  t.context.creds = { key: `password: ${Math.random()}` };
  t.context.serviceName = `test_${Math.random()}`;
  t.context.hub.addCredential(t.context.serviceName, t.context.creds);
  t.context.hub.start();
});

test.afterEach.always((t) => {
  t.context.hub.stop();
});

async function createClient(t) {
  return Client.create(
    `ws://localhost:${t.context.hub.address.port}`,
    t.context.serviceName,
    t.context.creds.key);
}

test('Should expose class', (t) => {
  t.is(typeof Client, 'function');
});

test('Create new Client', async (t) => {
  t.is(typeof Client.create, 'function');
  const client = await createClient(t);
  t.true(client.isOpen());
});
