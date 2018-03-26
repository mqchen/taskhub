
class ClientTask {
  constructor(client, action, payload) {
    this.client = client;
    this.action = action;
    this.payload = payload;
    this.result = null;
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

  async getResult() {
    return this.result;
  }
}

module.exports = ClientTask;
