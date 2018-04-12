/* eslint no-labels: "off" */
/* eslint-env es6 */
const uuid = require('uuid/v4');

const EventEmitter = require('event-emitter');

const EVENTS_AND_PROPS = {
  init: ['action', 'payload'],
  start: [],
  pickup: [],
  update: ['update'],
  drop: [],
  complete: ['result'],
  fail: [],
  cancel: [],
  end: []
};

class Task {
  constructor(id) {
    const _id = id || uuid();
    Object.defineProperty(this, 'id', { value: _id, writable: false });
    this._payload = null;
    this._result = null;
    this._state = null;
    this._messages = [];
    this._events = {};
    Object.keys(EVENTS_AND_PROPS).forEach((event) => { this._events[event] = []; });

    // Setup emitter
    this._setupEmitter();
  }

  _setupEmitter() {
    this._emitter = () => {};
    EventEmitter(this._emitter);
    ['on', 'off', 'once'].forEach((method) => {
      this[method] = (...args) => this._emitter[method](...args);
    });
  }

  static validateMessage(msg) {
    if (typeof msg !== 'object') throw new TypeError('Messages must be objects.');
    if (!['msgId', 'event'].every(key => Object.prototype.hasOwnProperty.call(msg, key))) {
      throw new TypeError('Messages must at least have props \'msgId\' and \'event\' to validate.');
    }
    if (!Object.prototype.hasOwnProperty.call(EVENTS_AND_PROPS, msg.event)) {
      throw new RangeError(`Message has unsupported event: '${msg.event}'. Supported events: ${Object.keys(EVENTS_AND_PROPS).join(', ')}`);
    }
    if (!EVENTS_AND_PROPS[msg.event].every(key => Object.prototype.hasOwnProperty.call(msg, key))) {
      throw new TypeError(`Messages of event '${msg.event}' must have props: ${EVENTS_AND_PROPS[msg.event].join(', ')}`);
    }
    return true;
  }

  _setState(event, time) {
    const now = time || Date.now();

    switch (event) {
      case 'init': break;
      case 'start':
        if (!this.hasHappened('init')) this._setState('init', now);
        break;
      case 'pickup':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'update':
        if (!this.hasHappened('pickup')) this._setState('pickup', now);
        break;
      case 'drop':
        if (!this.hasHappened('pickup')) this._setState('pickup', now);
        break;
      case 'complete':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'fail':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'cancel':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'end':
        if (!this.hasHappened('complete') && !this.hasHappened('cancel')) {
          this._setState('fail', now);
          this._setState('cancel', now);
        }
        break;
      default: return false;
    }

    this._state = event;
    this._events[event].push(now);
    this._emitter.emit(event, this);
    return true;
  }

  hasHappened(event) {
    return this._events[event].length > 0;
  }

  getState() {
    return this._state;
  }

  addMessage(rawMsg) {
    const msg = Object.assign({}, rawMsg);

    if (!Task.validateMessage(msg)) return false;

    if (this._messages.find(m => m.msgId === msg.msgId)) {
      throw Error('Message with same ID has already been added.');
    }

    // Remove unncessary props
    const okMsg = { msgId: msg.msgId, event: msg.event };
    EVENTS_AND_PROPS[msg.event].forEach((prop) => { okMsg[prop] = msg[prop]; });

    // Update task
    if (okMsg.payload) this._payload = okMsg.payload;
    if (okMsg.result) this._result = okMsg.result;

    this._messages.push(okMsg);
    this._setState(okMsg.event);

    return true;
  }

  getMessages() {
    return this._messages.map(a => ({ ...a })); // Return a copy of messages
  }

  async getPayload() {
    return Object.assign({}, this._payload);
  }

  async getResult(def) {
    const rej = () => {
      if (def) return Promise.resolve(def);
      return Promise.reject();
    };
    if (this.hasHappened('cancel')) return rej();
    if (this.hasHappened('fail')) return rej();
    if (this.hasHappened('complete')) return Promise.resolve(this._result);

    return new Promise((resolve, reject) => {
      const rej2 = () => {
        if (def) return resolve(def);
        return reject();
      };
      this.once('cancel', rej2);
      this.once('fail', rej2);
      this.once('complete', () => resolve(this._result));
    });
  }
}

module.exports = Task;
