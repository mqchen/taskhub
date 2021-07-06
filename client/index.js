const WebSocket = require('ws');
const URL = require('url');
const uuid = require('uuid').v4;
const ConsoleLogger = require('../common/consoleLogger');
const ClientTask = require('./clientTask');
const MemoryTaskStore = require('../common/stores/memory');

async function wait(ms) {
  return new Promise((resolve) => { setTimeout(() => resolve(), ms); });
}

class Client {
  constructor(url, service, key) {
    this.logger = ConsoleLogger;
    // Add basic auth to url:
    this.url = URL.format({ ...URL.parse(url), auth: `${service}:${key}` });
    this.ws = new WebSocket(this.url, 'ws');
    this.ws.on('message', this._processMessage.bind(this));
    this.ws.on('open', () => {
      this.logger.info('✅ Client online.');
      this.ws.on('close', () => this.logger.info('❌ Client offline.'));
    });
    this.subs = {};
    this.tasks = {};
    this.taskStore = new MemoryTaskStore();
  }

  _findSubs(action) {
    return this.subs[action] || [];
  }

  static async _connectClient(opts) {
    return new Promise((resolve, reject) => {
      const client = new Client(opts.url, opts.service, opts.key);
      client.ws.once('open', () => resolve(client));
      client.ws.once('error', (error) => reject(error));
    });
  }

  static async create(args) {
    const opts = {
      url: null,
      service: null,
      key: null,
      timeout: 1000,
      retryDelay: 10,
      ...args
    };
    let keepTrying = true;
    const startTime = new Date().getTime();
    do {
      try {
        const client = await Client._connectClient(opts); // eslint-disable-line no-await-in-loop
        return client;
      } catch (error) {
        if (error.code !== 'ECONNREFUSED') keepTrying = false;
        if (new Date().getTime() > startTime + opts.timeout) keepTrying = false;
        await wait(opts.retryDelay); // eslint-disable-line no-await-in-loop
      }
    } while (keepTrying);
    throw new Error('Connection timeout');
  }

  isOpen() {
    return this.ws.readyState === WebSocket.OPEN;
  }

  _processMessage(data) {
    this.logger.info('📨 Message received:', data);
    const msg = JSON.parse(data);
    if (!msg.taskId) return;
    (async () => {
      let task = await this.taskStore.get(msg.taskId);
      if (!task && msg.event === 'init') {
        task = new ClientTask(msg.taskId, this);
        await this.taskStore.add(task);
      }

      if (!task) {
        this.logger.warn(`Received an event belonging to unknown task. Ignoring it. Probably a bug in the Server. (msg: ${JSON.stringify(msg)})`);
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
    this.sendMessage({
      cmd: 'pub', event: 'init', action, payload, eventId, taskId
    });
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
    return this.pub(action, payload).then((task) => task.getResult(defaultResult));
  }
}

Client.Task = ClientTask;

module.exports = Client;
