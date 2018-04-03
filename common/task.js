
const PROPS = ['action', 'payload', 'event', 'id'];
const EVENTS = ['init', 'start', 'pickup', 'update', 'drop', 'complete', 'cancel', 'end'];

class Task {
  constructor() {
    this.payload = null;
    this.result = null;
    this.status = null;
    this._messages = [];
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

    // Payload is optional
    if (!msg.payload) msg.payload = null;

    if (!this.validateMessage(msg)) return false;

    if (this._messages.find(m => m.id === msg.id)) {
      throw Error('Message with same ID has already been added.');
    }

    // Remove unncessary props
    const okMsg = {};
    PROPS.forEach((prop) => {
      okMsg[prop] = msg[prop];
    });

    if (msg.payload) this.payload = msg.payload;

    // if (msg.event === 'complete') this.result = msg.result;
    this._messages.push(okMsg);

    return true;
  }

  getMessages() {
    return this._messages.map(a => ({ ...a })); // Return a copy of messages
  }

  async getPayload() {
    return Object.assign({}, this.payload);
  }

}

module.exports = Task;
