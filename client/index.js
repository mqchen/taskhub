const WebSocket = require('ws');
const uuid = require('uuid/v4');
const chalk = require('chalk');
const ClientTask = require('./ClientTask');
const MemoryTaskStore = require('../common/stores/memory');

class Client {
  constructor(url, service, key) {
    this.url = url;
    this.ws = new WebSocket(url, 'ws', {
      headers: { service, key }
    });
    this.ws.on('message', this._processMessage.bind(this));
    this.ws.on('open', () => this.logger.log(chalk.green('Client online.')));
    this.ws.on('close', () => this.logger.log(chalk.red('Client offline.')));
    this.subs = {};
    this.tasks = {};
    this.taskStore = new MemoryTaskStore();
    this.logger = console;
  }

  static async create(url, service, key) {
    return new Promise((resolve, reject) => {
      const client = new Client(url, service, key);
      client.ws.on('open', () => resolve(client));
      client.ws.on('close', () => reject(client));
    });
  }

  isOpen() {
    return this.ws.readyState === WebSocket.OPEN;
  }

  _processMessage(data) {
    this.logger.log(chalk.green('Message received:'), data);
    const msg = JSON.parse(data);
    console.log(msg);
    (async () => {
      const task = await this.taskStore.get(msg.taskId);

      if (!task) return this.logger.warn(chalk.yellow('Got an event beloging to unknown task.'));

      const callbacks = this._findSubs(msg.action);
      callbacks.push(task.fromCallback);
      callbacks.forEach((callback) => { callback.call(null, msg); });
    }).call(this);
  }

  /*
   * Publish new task and wait for it to initialize. Returns the task when initialized.
   */
  async pub(action, inputPayload) {
    const payload = inputPayload === undefined ? null : inputPayload;
    const eventId = uuid();
    const taskId = uuid();
    const task = new ClientTask(taskId, this);
    console.log('TASKID', taskId);
    this.taskStore.add(task);
    const promise = new Promise((resolve) => {
      task.once('init', () => { resolve(task); console.log('resolved?'); });
    });
    this.ws.send(JSON.stringify({ cmd: 'pub', event: 'init', action, payload, eventId, taskId }));
    return promise;
  }

  _findSubs(action) {
    return this.subs[action] || [];
  }

  sub(action, callback) {
    if (!this.subs[action]) this.subs[action] = [];
    this.subs[action].push(callback);

    this.ws.send(JSON.stringify({ cmd: 'sub', action }));
  }
}

Client.Task = ClientTask;

module.exports = Client;
