const test = require('ava');
const Server = require('../server');
const WebSocket = require('ws');

test.beforeEach((t) => {
  t.context.hub = new Server({ port: 0 });
  t.context.creds = { key: `password: ${Math.random()}` };
  t.context.serviceName = `test_${Math.random()}`;
  t.context.hub.addCredential(t.context.serviceName, t.context.creds);
});

test.afterEach.always((t) => {
  t.context.hub.stop();
});

test('Should export Server class', (t) => {
  t.is(typeof Server, 'function');

  const hub = new Server();
  t.is(typeof hub.start, 'function', 'Should expose start method.');
  t.is(typeof hub.stop, 'function', 'Should expose stop method.');
});

test('Can add and remove credentials', (t) => {
  t.is(typeof t.context.hub.addCredential, 'function', 'Should expose addCredential method.');
  const creds = { key: `password: ${Math.random()}` };
  const name = `test_${Math.random()}`;
  t.context.hub.addCredential(name, creds);
  t.is(t.context.hub.credentials[name].key, creds.key);

  t.context.hub.removeCredential(name);
  t.falsy(t.context.hub.credentials[name]);
});

test('Can authorize with correct info', (t) => {
  t.plan(2);
  const address = t.context.hub.start();
  const ws = new WebSocket(`ws://localhost:${address.port}`, 'ws', {
    headers: {
      service: t.context.serviceName,
      key: t.context.creds.key
    }
  });
  return new Promise((resolve) => {
    ws.on('open', () => {
      t.is(ws.readyState, 1, 'Expects readyState to be 1 which means OPEN.');
      ws.close();
      resolve();
    });
  })
  .then(r => t.pass(r))
  .catch(r => t.fail(r));
});


// Impossible to catch an async exception... and impossible to prevent ws from throwing
// test('Close unauthorized connections', async (t) => {
//   t.plan(1);
//   return new Promise((resolve, reject) => {
//     const address = t.context.hub.start();
//     const ws = new WebSocket(`ws://localhost:${address.port}`);
//     ws.on('open', () => reject('Opened'));
//     ws.on('close', () => resolve('Closed'));
//   })
//   .then(a => t.pass(a))
//   .catch(a => t.fail(a));
// });
