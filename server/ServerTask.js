
class ServerTask {
  constructor(action, payload) {
    this.action = action;
    this.payload = payload;
    this.messages = [];
  }

  addMessage(msg) {
    if (!['init', 'start', 'pickup', 'update', 'drop', 'complete', 'cancel', 'end']
      .includes(msg.event)) {
      throw new RangeError(`Unsupported event: '${msg.event}'.`);
    }

    this.messages.push(msg);
  }
}

module.exports = ServerTask;
