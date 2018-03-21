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

async function createConnection(t) {
  const address = t.context.hub.isRunning()
    ? t.context.hub.address
    : t.context.hub.start();
  return new Promise((resolve) => {
    const ws = new WebSocket(`ws://localhost:${address.port}`, 'ws', {
      headers: {
        service: t.context.serviceName,
        key: t.context.creds.key
      }
    });
    ws.on('open', () => resolve(ws));
  });
}

async function oneResponse(ws) {
  return new Promise((resolve) => {
    function tmpFunc(msg) {
      ws.removeEventListener('message', tmpFunc);
      resolve(JSON.parse(msg));
    }
    ws.on('message', tmpFunc);
  });
}

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

test('Can authorize with correct info', async (t) => {
  const ws = await createConnection(t);
  t.is(ws.readyState, WebSocket.OPEN, 'Expects readyState to be OPEN.');
  ws.close();
});

test('Send bad message and expect error message back', async (t) => {
  const ws = await createConnection(t);
  const msg1 = 'not JSON';
  ws.send(msg1);
  let reply = await oneResponse(ws);
  t.is(reply.status, 'error');
  t.is(reply.error, 'SyntaxError');
  t.is(reply.request, msg1);

  const msg2 = JSON.stringify({ validJSONMessage: 'but without necessary fields' });
  ws.send(msg2);
  reply = await oneResponse(ws);
  t.is(reply.status, 'error');
  t.is(reply.error, 'TypeError');
  t.deepEqual(reply.request, msg2);
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
