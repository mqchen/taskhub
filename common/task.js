/* eslint class-methods-use-this: "off" */
/* eslint-env es6 */

const EventEmitter = require('event-emitter');

const PROPS = ['action', 'event', 'id', 'payload', 'result'];
const EVENTS = ['init', 'start', 'pickup', 'update', 'drop', 'complete', 'cancel', 'end'];

class Task {
  constructor() {
    this._payload = null;
    this._result = null;
    this._status = null;
    this._messages = [];

    // Setup emitter
    this._emitter = () => {};
    EventEmitter(this._emitter);
    ['on', 'off', 'once'].forEach((method) => {
      this[method] = this._emitter[method];
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

    this._messages.push(okMsg);
    this._status = okMsg.event;

    switch (this._status) {
      case 'init':
        if (okMsg.payload) this._payload = okMsg.payload;
        break;
      case 'complete':
        if (okMsg.result) this._result = okMsg.result;
        break;
      default:
    }

    return true;
  }

  getMessages() {
    return this._messages.map(a => ({ ...a })); // Return a copy of messages
  }

  async getPayload() {
    return Object.assign({}, this._payload);
  }

  async getResult() {
    return this._result;
  }
}

module.exports = Task;
