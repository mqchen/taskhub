const test = require('ava');
const winston = require('winston');
const WebSocket = require('ws');
const uuid = require('uuid').v4;
const Server = require('../server');

Server.defaultLogger = winston.createLogger({
  level: 'debug',
  transports: [new winston.transports.Console({
    format: winston.format.simple()
  })]
});

test.beforeEach((t) => {
  t.context.hub = new Server({ port: 0 });
  t.context.creds = { key: `password_${Math.random()}` };
  t.context.serviceName = `test_${Math.random()}`;
  t.context.hub.addCredentials(t.context.serviceName, t.context.creds);
});

test.afterEach.always((t) => {
  t.context.hub.stop();
});

async function createConnection(t) {
  const address = t.context.hub.isRunning()
    ? t.context.hub.address
    : t.context.hub.start();
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://${t.context.serviceName}:${t.context.creds.key}@localhost:${address.port}`, 'ws');
    ws.once('open', () => resolve(ws));
    ws.once('error', (error) => reject(error));
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

  const { hub } = t.context;
  t.is(typeof hub.start, 'function', 'Should expose start method.');
  t.is(typeof hub.stop, 'function', 'Should expose stop method.');
});

test('Can add and remove credentials', (t) => {
  t.is(typeof t.context.hub.addCredentials, 'function', 'Should expose addCredential method.');
  const creds = { key: `password: ${Math.random()}` };
  const name = `test_${Math.random()}`;
  t.context.hub.addCredentials(name, creds);
  t.is(t.context.hub.credentials[name].key, creds.key);

  t.context.hub.removeCredentials(name);
  t.falsy(t.context.hub.credentials[name]);
});

test('Can authorize with correct info', async (t) => {
  const ws = await createConnection(t);
  t.is(ws.readyState, WebSocket.OPEN, 'Expects readyState to be OPEN.');
  t.deepEqual(Object.keys(t.context.hub.clients), [t.context.serviceName], 'Client should be registered and identified');
  ws.close();
});

test('Invalid message returns error message', async (t) => {
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

  const msg3 = JSON.stringify({ cmd: 'invalid type' });
  ws.send(msg3);
  reply = await oneResponse(ws);
  t.is(reply.status, 'error');
  t.is(reply.error, 'TypeError');
  t.deepEqual(reply.request, msg3);

  const msg4 = JSON.stringify({
    cmd: 'pub', action: '', payload: {}, taskId: uuid(), eventId: uuid(), event: 'invalid event'
  });
  ws.send(msg4);
  reply = await oneResponse(ws);
  t.is(reply.status, 'error');
  t.is(reply.error, 'RangeError');
  t.deepEqual(reply.request, msg4);
});

test('Sub message should add subscriber, and a Pub msg should trigger it', async (t) => {
  const ws1 = await createConnection(t);
  const ws2 = await createConnection(t);
  const action = `test-service:method_${Math.random()}`;

  ws1.send(JSON.stringify({ cmd: 'sub', action }));
  const reply = await oneResponse(ws1);

  t.is(reply.status, 'ok');
  t.is(t.context.hub._findSubs(action).length, 1, 'Should add something in subs.');

  ws2.send(JSON.stringify({
    cmd: 'pub', action, payload: {}, taskId: uuid(), eventId: uuid(), event: 'init'
  }));
  const reply2 = await oneResponse(ws1);

  t.is(reply2.status, 'ok');
  t.is(reply2.action, action);
});

test('Complete msg should update subscribers with result', async (t) => {
  const ws1 = await createConnection(t);
  const ws2 = await createConnection(t);
  const action = `test-service:method_${Math.random()}`;
  const result = `result_${Math.random()}`;
  const taskId = uuid();

  ws1.send(JSON.stringify({ cmd: 'sub', action }));
  await oneResponse(ws1); // Pop

  ws2.send(JSON.stringify({
    cmd: 'pub', event: 'init', action, payload: {}, taskId, eventId: uuid()
  }));
  const reply1 = await oneResponse(ws1);
  t.is(reply1.event, 'init');

  ws2.send(JSON.stringify({
    cmd: 'pub', event: 'success', result, taskId, eventId: uuid()
  }));
  const reply3 = await oneResponse(ws1);
  t.is(reply3.result, result);
});

test('The client that publishes a task should be updated when its own tasks are updated, regardless of sub.', async (t) => {
  const ws1 = await createConnection(t);
  const ws2 = await createConnection(t);
  const action1 = `test-service:method_${Math.random()}`;
  const action2 = `test-service:method_${Math.random()}`;
  const result = `result_${Math.random()}`;
  const taskId = uuid();

  ws1.send(JSON.stringify({ cmd: 'sub', action: action1 }));
  await oneResponse(ws1); // Pop

  ws2.send(JSON.stringify({ cmd: 'sub', action: action2 }));
  await oneResponse(ws2); // Pop

  // WS2 sends an event about 'action1' which WS2 is not subscribed to
  // Since WS2 sent it, it should get all events about it's task
  ws2.send(JSON.stringify({
    cmd: 'pub', event: 'init', action: action1, payload: {}, taskId, eventId: uuid()
  }));
  await oneResponse(ws1); // Pop
  const reply1 = await oneResponse(ws2);
  t.is(reply1.event, 'init'); // WS2 should get the event about it's task even though it is not subbed to action1

  ws1.send(JSON.stringify({
    cmd: 'pub', event: 'success', result, taskId, eventId: uuid()
  }));
  const reply2 = await oneResponse(ws2);
  t.is(reply2.event, 'success'); // WS2 should get the event about it's task even though it is not subbed to action1
});

test('Close unauthorized connections', async (t) => {
  t.plan(1);
  return new Promise((resolve, reject) => {
    const address = t.context.hub.start();
    const ws = new WebSocket(`ws://localhost:${address.port}`);
    ws.once('open', () => reject(new Error('Opened')));
    ws.once('error', () => resolve('Closed'));
  })
    .then((a) => t.pass(a))
    .catch((a) => t.fail(a));
});
