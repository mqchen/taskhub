
class ServerTask {
  constructor(id, action, payload) {
    this.id = id;
    this.action = action;
    this.payload = payload;
    this.messages = [];
    this.lastEvent = null;
    this.result = null;
  }

  static validateMessage(msg) {
    if (!['action', 'payload', 'event', 'id']
      .every(key => Object.prototype.hasOwnProperty.call(msg, key))) {
      throw new TypeError('Tasks must have props: action, payload, event, id.');
    }
    if (!['init', 'start', 'pickup', 'update', 'drop', 'complete', 'cancel', 'end']
      .includes(msg.event)) {
      throw new RangeError(`Unsupported event: '${msg.event}'.`);
    }
    return true;
  }

  addMessage(msg) {
    if (msg.payload) this.payload = msg.payload;
    this.lastEvent = msg.event;

    if (msg.event === 'complete') this.result = msg.result;
    this.messages.push(msg);
  }
}

module.exports = ServerTask;
