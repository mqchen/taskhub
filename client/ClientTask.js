
class ClientTask {
  constructor(action, payload) {
    this.action = action;
    this.payload = payload;
  }

  // TODO
  async getPayload() {}
  pickup() {}
  drop() {}
  update() {}
  complete() {}

  on() {}
  off() {}
  once() {}

  async getResult() {}
}

module.exports = ClientTask;
