const WebSocket = require('ws');
const URL = require('url');
const uuid = require('uuid/v4');
const chalk = require('chalk');
const ClientTask = require('./clientTask');
const MemoryTaskStore = require('../common/stores/memory');

class Client {
  constructor(url, service, key) {
    // Add basic auth to url:
    this.url = URL.format({ ...URL.parse(url), auth: `${service}:${key}` });
    this.ws = new WebSocket(this.url, 'ws');
    this.ws.on('message', this._processMessage.bind(this));
    this.ws.on('open', () => this.logger.info(chalk.green('Client online.')));
    this.ws.on('close', () => this.logger.info(chalk.red('Client offline.')));
    this.subs = {};
    this.tasks = {};
    this.taskStore = new MemoryTaskStore();
    this.logger = Client.defaultLogger;
  }

  _findSubs(action) {
    return this.subs[action] || [];
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
    this.logger.info(chalk.green('Message received:'), data);
    const msg = JSON.parse(data);
    if (!msg.taskId) return;
    (async () => {
      let task = await this.taskStore.get(msg.taskId);
      if (!task && msg.event === 'init') {
        task = new ClientTask(msg.taskId, this);
        await this.taskStore.add(task);
      }

      if (!task) {
        this.logger.warn(chalk.yellow(`Received an event belonging to unknown task. Ignoring it. Probably a bug in the Server. (msg: ${JSON.stringify(msg)})`));
      } else {
        task.addEvent(msg);
        const callbacks = this._findSubs(msg.action);
        callbacks.forEach((callback) => { callback.call(null, task); });
      }
    }).call(this);
  }

  sendMessage(data) {
    this.ws.send(JSON.stringify(data));
  }

  /*
   * Publish new task and wait for it to initialize. Returns the task when initialized.
   */
  async pub(action, inputPayload) {
    const payload = inputPayload === undefined ? null : inputPayload;
    const eventId = uuid();
    const taskId = uuid();
    const task = new ClientTask(taskId, this);
    this.taskStore.add(task);
    const promise = new Promise((resolve) => {
      task.once('init', () => { resolve(task); });
    });
    this.sendMessage({ cmd: 'pub', event: 'init', action, payload, eventId, taskId });
    return promise;
  }

  /*
   * Subscribe to actions.
   */
  sub(action, callback) {
    if (!this.subs[action]) this.subs[action] = [];
    this.subs[action].push(callback);

    this.sendMessage({ cmd: 'sub', action });
  }

  /*
   * Short-hand for pub and getResult.
   */
  async do(action, payload, defaultResult) {
    return this.pub(action, payload).then(task => task.getResult(defaultResult));
  }
}

Client.defaultLogger = console;

Client.Task = ClientTask;

module.exports = Client;
