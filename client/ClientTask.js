const Task = require('../common/task');
const uuid = require('uuid/v4');

class ClientTask extends Task {
  constructor(id, client) {
    super(id);
    this.client = client;
  }

  sendEvent(event, other) {
    this.client.sendMessage({ cmd: 'pub', event, eventId: uuid(), taskId: this.id, ...other });
  }

  start() {
    this.sendEvent('start');
  }

  update(update) {
    this.sendEvent('update', { update });
  }

  drop() {
    this.sendEvent('drop');
  }

  success() {}
  fail() {}
}

module.exports = ClientTask;
