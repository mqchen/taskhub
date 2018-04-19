const Task = require('../common/task');

class ClientTask extends Task {
  constructor(id, client) {
    super(id);
    this.client = client;
  }

  // TODO: needs to send event messages
  pickup() {}
  drop() {}
  update() {}
  success() {}
  fail() {}
}

module.exports = ClientTask;
