const test = require('ava');
const uuid = require('uuid/v4');
const Task = require('../common/task');

async function wait(ms) {
  return new Promise((resolve) => { setTimeout(() => resolve(), ms); });
}

test('setting state and lifecycle logic', (t) => {
  const task1 = new Task();
  t.true(task1._setState('init'));
  t.is(task1.state, 'init');

  const task2 = new Task();
  t.true(task2._setState('update'));
  t.is(task2.state, 'update');
  t.true(task2.hasHappened('start'), 'Setting update should implicitly have set start.');
  t.true(task2.hasHappened('init'), 'Setting start should implicitly have set init.');
  t.false(task2.hasHappened('success', 'Setting update should not set complete.'));

  task2._setState('end');
  t.true(task2.hasHappened('success'), 'Setting end without success should be considered success.');

  const task3 = new Task();
  task3._setState('success');
  t.true(task3.hasHappened('start'));
  t.true(task3.hasHappened('success'));

  const task4 = new Task();
  task4._setState('fail');
  t.true(task4.hasHappened('start'));
  t.true(task4.hasHappened('fail'));
  t.false(task4.hasHappened('success'));

  const task5 = new Task();
  task5._setState('end');
  t.true(task5.hasHappened('init'));
  t.true(task5.hasHappened('start'));
  t.true(task5.hasHappened('end'));
  t.true(task5.hasHappened('success', 'Ending a new task means it succeeded'));
  t.false(task5.hasHappened('fail', 'Ending a new task does not implicitly mean failed'));
});

test('validateEvent()', (t) => {
  t.is(typeof Task.validateEvent, 'function', 'Should have _static_ validateEvent method');

  const badMsg1 = 'not even json';
  t.throws(() => {
    Task.validateEvent(badMsg1);
  }, TypeError);

  const badMsg2 = { json: 'but missing', mandatory: 'fields' };
  t.throws(() => {
    Task.validateEvent(badMsg2);
  }, TypeError);

  const badMsg3 = { action: 'something', payload: null, result: null, eventId: 'x', event: 'UNSUPPORTED EVENT' };
  t.throws(() => {
    Task.validateEvent(badMsg3);
  }, RangeError);


  const EVENTS_AND_PROPS = {
    init: ['action', 'payload'],
    start: [],
    update: ['update'],
    drop: [],
    success: ['result'],
    fail: ['reason'],
    end: []
  };

  Object.keys(EVENTS_AND_PROPS).forEach((event) => {
    const goodMsg = { eventId: uuid(), event };
    EVENTS_AND_PROPS[event].forEach((prop) => { goodMsg[prop] = `test_${Math.random()}`; });
    t.notThrows(() => { t.true(Task.validateEvent(goodMsg)); });
  });
});

test('get events()', (t) => {
  const task = new Task();
  t.deepEqual(task.events, []);
});

test('addEvent()', (t) => {
  const task = new Task();
  t.is(typeof task.addEvent, 'function', 'Should have addEvent method.');

  t.truthy(task.addEvent({ action: 'hello:world', eventId: uuid(), event: 'init', payload: null }), 'Should be able to add without the optional props: payload and result');
});

test('addEvent(): should prevent duplicate messages being added', (t) => {
  const task = new Task();
  t.is(typeof task.addEvent, 'function', 'Should have addEvent method.');

  const id = uuid();

  task.addEvent({ event: 'init', action: 'hello:world', eventId: id, payload: null });
  t.throws(() => { task.addEvent({ eventId: id, event: 'start' }); }, Error, 'Should throw when adding message of same id twice.');
  task.addEvent({ event: 'start', eventId: uuid() });

  t.is(task.events.length, 2, 'The duplicate event should be ignored.');
});

test('addEvent(): should exclude unnecessary props from messages.', (t) => {
  const task = new Task();

  const bloatedMsg = { action: 'hello:world', payload: null, eventId: uuid(), event: 'init', something: 'else' };
  const expectedMsg = { ...bloatedMsg };
  delete expectedMsg.something;

  task.addEvent(bloatedMsg);
  t.deepEqual(task.events, [expectedMsg], 'Should only have the whitelisted props.');
});

test('getEvents(): should return copies of messages', (t) => {
  const task = new Task();

  const id = uuid();
  const msg = { action: 'hello:world', eventId: id, event: 'init', payload: null };
  task.addEvent(msg);

  t.not(task.events[0], msg, 'Should be equal but not the same object.');
  t.deepEqual(task.events, [msg], 'Should be equal.');
});

test('getPayload()', async (t) => {
  const task = new Task();

  t.is(typeof task.getPayload, 'function');

  const msg1 = { action: 'a', eventId: uuid(), payload: { foo: 'bar' }, event: 'init' };
  task.addEvent(msg1);

  t.not(await task.getPayload(), msg1.payload);
  t.deepEqual(await task.getPayload(), msg1.payload);

  task.addEvent({ ...msg1, eventId: uuid(), payload: null });
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
  task.on('success', (argTask) => {
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
  task.addEvent({ event: 'success', result: expectedResult, eventId: uuid() });

  t.is(await task.getResult(), expectedResult, 'Getting result from completed task should return it immediately.');

  await wait(10); // Make sure everything has time to run
});

test('getResult(): getting from failed task without default should throw exception', async (t) => {
  t.plan(1);
  const task = new Task();
  task.addEvent({ event: 'fail', reason: 'no reason...', eventId: uuid() });
  task.getResult().catch(() => t.pass());

  await wait(10); // Make sure everything has time to run
});

test('getResult(): getting result from failed task with default', async (t) => {
  t.plan(1);

  const task = new Task();
  const expectedResult = `result_${uuid()}`;
  task.addEvent({ event: 'fail', reason: 'no reason...', eventId: uuid() });
  t.is(await task.getResult(expectedResult), expectedResult, 'Should return default on failed task.');
});

test('getReason(): get fail reason, if task has failed', async (t) => {
  t.plan(1);

  const task = new Task();
  task.addEvent({ event: 'fail', reason: 'some reason...', eventId: uuid() });
  t.is(await task.getReason(), 'some reason...');
});

test('on() and once(): adding a listener to an event that has happened should be triggered immediately.', async (t) => {
  t.plan(3);
  const task = new Task();
  task.addEvent({ action: 'hello:world', eventId: uuid(), event: 'init', payload: null });
  task.on('init', () => { t.pass(); });
  task.addEvent({ eventId: uuid(), event: 'start' });
  task.once('init', () => { t.pass(); });
  task.on('start', () => { t.pass(); });
});
