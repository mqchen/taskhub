/* eslint no-labels: "off" */
/* eslint-env es6 */
const uuid = require('uuid/v4');

const EventEmitter = require('event-emitter');

const EVENTS_AND_PROPS = {
  init: ['action', 'payload'],
  start: [],
  update: ['update'],
  drop: [],
  success: ['result'],
  fail: ['reason'],
  end: []
};

class Task {
  constructor(id, fromService) {
    const _id = id || uuid();
    Object.defineProperty(this, 'id', { value: _id, writable: false });
    this._fromService = fromService;
    this._action = null;
    this._payload = null;
    this._result = null;
    this._failReason = null;
    this._state = null;
    this._eventMessages = [];
    this._eventTimestamps = {};
    Object.keys(EVENTS_AND_PROPS).forEach((event) => { this._eventTimestamps[event] = []; });

    // Setup emitter
    this._emitter = EventEmitter();
    // this._setupEmitter();
  }

  get action() {
    return this._action;
  }

  get state() {
    return this._state;
  }

  get fromService() {
    return this._fromService;
  }

  on(...args) {
    if (this.hasHappened(args[0])) return args[1].call(this, this);
    return this._emitter.on(...args);
  }

  once(...args) {
    if (this.hasHappened(args[0])) return args[1].call(this, this);
    return this._emitter.once(...args);
  }

  off(...args) {
    return this._emitter.off(...args);
  }

  static validateEvent(event) {
    if (typeof event !== 'object') throw new TypeError('Event messages must be objects.');
    if (!['eventId', 'event'].every((key) => Object.prototype.hasOwnProperty.call(event, key))) {
      throw new TypeError('Messages must at least have props \'eventId\' and \'event\' to validate.');
    }
    if (!Object.prototype.hasOwnProperty.call(EVENTS_AND_PROPS, event.event)) {
      throw new RangeError(`Event message has unsupported event: '${event.event}'. Supported events: ${Object.keys(EVENTS_AND_PROPS).join(', ')}`);
    }
    if (!EVENTS_AND_PROPS[event.event]
      .every((key) => Object.prototype.hasOwnProperty.call(event, key))) {
      throw new TypeError(`Event messages of event '${event.event}' must have props: ${EVENTS_AND_PROPS[event.event].join(', ')}`);
    }
    return true;
  }

  _setState(state, time) {
    const now = time || Date.now();

    switch (state) {
      case 'init': break;
      case 'start':
        if (!this.hasHappened('init')) this._setState('init', now);
        break;
      case 'update':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'drop':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'success':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'fail':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'end':
        if (!this.hasHappened('success') && !this.hasHappened('fail')) {
          this._setState('success');
        }
        break;
      default: return false;
    }

    this._state = state;
    this._eventTimestamps[state].push(now);
    this._emitter.emit(state, this);
    return true;
  }

  hasHappened(state) {
    return this._eventTimestamps[state].length > 0;
  }

  addEvent(rawMsg) {
    const msg = { ...rawMsg };

    if (!Task.validateEvent(msg)) return false;

    if (this._eventMessages.find((m) => m.eventId === msg.eventId)) {
      throw Error(`Message with same ID has already been added. ${JSON.stringify(msg)}`);
    }

    // Remove unncessary props
    const okMsg = { eventId: msg.eventId, event: msg.event };
    EVENTS_AND_PROPS[msg.event].forEach((prop) => { okMsg[prop] = msg[prop]; });

    // Update task (EVENTS_AND_PROPS decides if these get to update or not)
    if (okMsg.action) this._action = okMsg.action;
    if (okMsg.payload) this._payload = okMsg.payload;
    if (okMsg.result) this._result = okMsg.result;
    if (okMsg.reason) this._failReason = okMsg.reason;

    this._eventMessages.push(okMsg);
    this._setState(okMsg.event);

    return true;
  }

  get events() {
    return this._eventMessages.map((a) => ({ ...a })); // Return a copy of messages
  }

  getLastEvent() {
    return { ...this._eventMessages.slice(-1)[0], taskId: this.id };
  }

  async getPayload() {
    return { ...this._payload };
  }

  async getResult(def) {
    const rej = () => {
      if (def) return Promise.resolve(def);
      return Promise.reject();
    };
    if (this.hasHappened('fail')) return rej();
    if (this.hasHappened('success')) return Promise.resolve(this._result);

    return new Promise((resolve, reject) => {
      const rej2 = () => {
        if (def) return resolve(def);
        return reject();
      };
      this.once('fail', rej2);
      this.once('success', () => resolve(this._result));
    });
  }

  async getReason() {
    return this._failReason;
  }
}

module.exports = Task;
