const test = require('ava');
const uuid = require('uuid/v4');
const Task = require('../common/task');

async function wait(ms) {
  return new Promise((resolve) => { setTimeout(() => resolve(), ms); });
}

test('setting state and lifecycle logic', (t) => {
  const task1 = new Task();

  t.true(task1._setState('init'));
  t.is(task1.getState(), 'init');

  const task2 = new Task();

  t.true(task2._setState('update'));
  t.is(task2.getState(), 'update');
  t.true(task2.hasHappened('pickup'), 'Setting update should implicitly have set pickup.');
  t.true(task2.hasHappened('start'), 'Setting pickup should implicitly have set start.');
  t.true(task2.hasHappened('init'), 'Setting start should implicitly have set init.');
  t.false(task2.hasHappened('complete', 'Setting update should not set complete.'));

  task2._setState('end');
  t.true(task2.hasHappened('cancel'), 'Setting end without complete implicitly sets cancel.');
  t.false(task2.hasHappened('complete'), 'Setting end without complete should not set complete.');
});

test('validateMessage()', (t) => {
  const task = new Task();
  t.is(typeof task.validateMessage, 'function', 'Should have validateMessage method');

  const badMsg1 = 'not even json';
  t.throws(() => {
    task.validateMessage(badMsg1);
  }, TypeError);

  const badMsg2 = { json: 'but missing', mandatory: 'fields' };
  t.throws(() => {
    task.validateMessage(badMsg2);
  }, TypeError);

  const badMsg3 = { action: 'something', payload: null, result: null, id: 'x', event: 'UNSOPPORTED EVENT' };
  t.throws(() => {
    task.validateMessage(badMsg3);
  }, RangeError);

  ['init', 'start', 'pickup', 'update', 'drop', 'complete', 'cancel', 'end'].forEach((event) => {
    const goodMsg = { action: 'something', payload: null, result: null, id: 'x', event };
    t.notThrows(() => {
      t.true(task.validateMessage(goodMsg));
    });
  });
});

test('getMessages()', (t) => {
  const task = new Task();
  t.is(typeof task.getMessages, 'function');
  t.deepEqual(task.getMessages(), []);
});

test('addMessage()', (t) => {
  const task = new Task();
  t.is(typeof task.addMessage, 'function', 'Should have addMessage method.');

  t.truthy(task.addMessage({ action: 'hello:world', id: uuid(), event: 'init' }), 'Should be able to add without the optional props: payload and result');
});

test('addMessage(): should prevent duplicate messages being added', (t) => {
  const task = new Task();
  t.is(typeof task.addMessage, 'function', 'Should have addMessage method.');

  const id = uuid();

  task.addMessage({ action: 'hello:world', id, event: 'init' });
  t.throws(() => { task.addMessage({ action: 'hello:world', id, event: 'start' }); }, Error);
  task.addMessage({ action: 'hello:world', id: uuid(), event: 'start' });

  t.is(task.getMessages().length, 2, 'The duplicate event should be ignored.');
});

test('addMessage(): should exclude unnecessary props from messages.', (t) => {
  const task = new Task();

  const bloatedMsg = { action: 'hello:world', payload: null, result: null, id: uuid(), event: 'init', something: 'else' };
  const expectedMsg = { ...bloatedMsg };
  delete expectedMsg.something;

  task.addMessage(bloatedMsg);
  t.deepEqual(task.getMessages(), [expectedMsg], 'Should only have the whitelisted props.');
});

test('getMessages(): should return copies of messages', (t) => {
  const task = new Task();

  const id = uuid();
  const msg = { action: 'hello:world', id, payload: null, event: 'init', result: null };
  task.addMessage(msg);

  t.not(task.getMessages()[0], msg, 'Should be equal but not the same object.');
  t.deepEqual(task.getMessages(), [msg], 'Should be equal.');
});

test('getPayload()', async (t) => {
  const task = new Task();

  t.is(typeof task.getPayload, 'function');

  const msg1 = { action: 'a', id: uuid(), payload: { foo: 'bar' }, event: 'init' };
  task.addMessage(msg1);

  t.not(await task.getPayload(), msg1.payload);
  t.deepEqual(await task.getPayload(), msg1.payload);

  task.addMessage({ ...msg1, id: uuid(), payload: null });
  t.not(await task.getPayload(), null, 'Events without payloads should not overwrite the payload.');
});

test('should be able to add listeneres that are triggered by state changes', async (t) => {
  t.plan(7);

  const task = new Task();

  ['on', 'off', 'once'].forEach((method) => {
    t.is(typeof task[method], 'function', `${method}() should be available.`);
  });

  t.falsy(task.emit, 'emit() should not be available from the outside.');

  task.on('init', (argTask) => {
    t.is(argTask, task, 'Listeneres should be called with task object.');
  });
  task.on('start', (argTask) => {
    t.is(argTask, task, 'Listeneres should be called with task object.');
  });
  task.on('cancel', (argTask) => {
    t.is(argTask, task, 'Listeneres should be called with task object.');
  });
  task._setState('end');
});

test('getResult(): should resolve when complete event has been triggered', async (t) => {
  t.plan(3);

  const task = new Task();
  const expectedResult = `result_${uuid()}`;

  t.is(typeof task.getResult, 'function');

  task.getResult().then((result) => {
    t.is(result, expectedResult, 'Should be the result from the message');
  });
  task.addMessage({ event: 'complete', action: 'something', result: expectedResult, id: uuid() });

  t.is(await task.getResult(), expectedResult, 'Getting result from completed task should return it immediately.');

  await wait(10); // Make sure everything has time to run
});

test('getResult(): getting from cancelled task without default should throw exception', async (t) => {
  t.plan(1);
  const task = new Task();
  task.addMessage({ event: 'cancel', action: 'test', id: uuid() });
  task.getResult().catch(() => t.pass());
});

test('getResult(): getting result from cancelled task with default', async (t) => {
  t.plan(1);
  const task = new Task();
  const expectedResult = `result_${uuid()}`;
  task.addMessage({ event: 'cancel', action: 'test', id: uuid() });
  t.is(await task.getResult(expectedResult), expectedResult, 'Should return default on cancelled task.');
});
