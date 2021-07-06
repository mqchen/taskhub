const uuid = require('uuid').v4;
const Task = require('../common/task');

class ClientTask extends Task {
  constructor(id, client) {
    super(id);
    this.client = client;
  }

  sendEvent(event, other) {
    this.client.sendMessage({
      cmd: 'pub', event, eventId: uuid(), taskId: this.id, ...other
    });
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

  success(result) {
    this.sendEvent('success', { result });
    this.sendEvent('end', { result });
  }

  fail(reason) {
    this.sendEvent('fail', { reason });
    this.sendEvent('end', { reason });
  }
}

module.exports = ClientTask;
