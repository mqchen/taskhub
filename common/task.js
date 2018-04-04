/* eslint class-methods-use-this: "off" */
/* eslint no-labels: "off" */
/* eslint-env es6 */

const EventEmitter = require('event-emitter');

const PROPS = ['action', 'event', 'id', 'payload', 'result'];
const EVENTS = ['init', 'start', 'pickup', 'update', 'drop', 'complete', 'cancel', 'end'];

class Task {
  constructor() {
    this._payload = null;
    this._result = null;
    this._state = null;
    this._messages = [];
    this._events = {};
    EVENTS.forEach((event) => { this._events[event] = []; });

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

  validateMessage(msg) {
    if (typeof msg !== 'object') throw new TypeError('Messages must be JSON.');
    if (!PROPS.every(key => Object.prototype.hasOwnProperty.call(msg, key))) {
      throw new TypeError('Messages must have props: action, payload, event, id.');
    }
    if (!EVENTS.includes(msg.event)) {
      throw new RangeError(`Unsupported event in message: '${msg.event}'.`);
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
      case 'cancel':
        if (!this.hasHappened('start')) this._setState('start', now);
        break;
      case 'end':
        if (!this.hasHappened('complete') && !this.hasHappened('cancel')) {
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

    // Payload and result is optional
    if (!msg.payload) msg.payload = null;
    if (!msg.result) msg.result = null;

    if (!this.validateMessage(msg)) return false;

    if (this._messages.find(m => m.id === msg.id)) {
      throw Error('Message with same ID has already been added.');
    }

    // Remove unncessary props
    const okMsg = {};
    PROPS.forEach((prop) => { okMsg[prop] = msg[prop]; });

    switch (okMsg.event) {
      case 'init':
        if (okMsg.payload) this._payload = okMsg.payload;
        break;
      case 'complete':
        if (okMsg.result) this._result = okMsg.result;
        break;
      default:
    }

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
    if (this.hasHappened('complete')) return Promise.resolve(this._result);
    if (this.hasHappened('cancel')) {
      if (def) return Promise.resolve(def);
      return Promise.reject();
    }
    return new Promise((resolve, reject) => {
      this.once('complete', () => resolve(this._result));
      this.once('cancel', () => {
        if (def) return resolve(def);
        return reject();
      });
    });
  }
}

module.exports = Task;
