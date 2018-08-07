/* eslint class-methods-use-this: ["error", { "exceptMethods": ["_sendMessageToClient"] }] */

const WebSocket = require('ws');
const chalk = require('chalk');
const Task = require('../common/task');
const MemoryTaskStore = require('../common/stores/memory');

class Server {
  constructor(opts) {
    const defaultOpts = {
      port: 8080,
      verifyClient: this._verfyClient.bind(this)
    };
    this.logger = Server.defaultLogger;
    this.opts = { ...defaultOpts, ...opts };
    this.server = null;
    this.address = null;
    this.credentials = {};
    this.clients = [];

    // subs
    this.subs = {};
    // Task store, will be moved to Redis or MongoDB in the future
    this.taskStore = new MemoryTaskStore();
  }

  start() {
    this.server = new WebSocket.Server(this.opts);
    this.logger.info(chalk.green('Starting server at:'), this.server.address().port);
    this.server.on('connection', (...args) => this._initClient(...args));
    this.address = this.server.address();
    return this.address;
  }

  isRunning() {
    return !!this.address;
  }

  stop() {
    if (this.server) this.server.close();
  }

  addCredential(service, creds) {
    this.logger.info(chalk.gray(`Credentials added for '${service}' service.`));
    this.credentials[service] = creds;
  }

  removeCredential(service) {
    delete this.credentials[service];
  }

  // Verify and init clients
  _verfyClient(info, cb) {
    const service = `${info.req.headers.service}`;
    const key = `${info.req.headers.key}`;

    if (this.credentials[service] && this.credentials[service].key === key) {
      cb(true);
      return;
    }
    cb(false, 401, 'Unauthorized');
  }

  _getClientsFor(serviceName) {
    return this.clients[serviceName] || [];
  }

  _initClient(client, req) {
    // Register client
    const serviceName = req.headers.service;
    if (!this.clients[serviceName]) this.clients[serviceName] = [];
    this._getClientsFor(serviceName).push(client);

    // Register events
    client.on('message', (data) => {
      try {
        this._execCommand(serviceName, client, data);
      } catch (e) {
        this.logger.info(chalk.yellow('Invalid message:'), e.message, data);
        this._sendMessageToClient(client, 'error', { error: e.name, message: e.message, request: data });
      }
    });
  }

  // Send messages
  _sendMessage(serviceName, status, msg) {
    this.logger.info(chalk.gray(`Sending ${status} message to '${serviceName}'.`), msg);
    this._getClientsFor(serviceName).forEach((client) => {
      this._sendMessageToClient(client, status, msg);
    });
  }

  _sendMessageToClient(client, status, msg) {
    if (!['ok', 'error'].includes(status)) throw new RangeError('Status must be either ok or error.');
    client.send(JSON.stringify({ status, ...msg }));
  }

  // Handle messages
  _execCommand(serviceName, client, rawMsg) {
    const msg = Server._parseCommand(rawMsg);
    switch (msg.cmd) {
      case 'pub': return this._execPubCmd(serviceName, client, msg);
      case 'sub': return this._execSubCmd(serviceName, client, msg);
      default:
        throw new TypeError(`Unsupported message cmd: ${msg.cmd}`);
    }
  }

  static _parseCommand(rawData) {
    const json = JSON.parse(rawData);
    if (!json.cmd) {
      throw new TypeError('Missing message command (prop: cmd).');
    }
    return json;
  }


  // Subscribe tasks
  _execSubCmd(serviceName, fromClient, msg) {
    if (!Object.prototype.hasOwnProperty.call(msg, 'action')) {
      throw new TypeError('Sub messages must have props: action.');
    }
    this._addSub(msg.action, serviceName);
    this._sendMessageToClient(fromClient, 'ok', { message: `Client subscribed to ${msg.action}.` });
  }

  _addSub(action, serviceName) {
    if (!this.subs[action]) this.subs[action] = [];
    if (this.subs[action].includes(serviceName)) return;
    this.subs[action].push(serviceName);
    this.logger.info(`'${serviceName}' is now subscribed to action: ${action}.`);
  }


  // Publish messages
  _execPubCmd(serviceName, client, msg) {
    if (!Object.prototype.hasOwnProperty.call(msg, 'taskId')) {
      throw new TypeError('Pub messages must have props: taskId.');
    }
    if (!Task.validateEvent(msg)) return; // It throws which is caught outside

    (async () => {
      // Get or create task from taskStore
      let task = await this.taskStore.get(msg.taskId);
      if (!task) {
        task = new Task(msg.taskId, serviceName);
        this.taskStore.add(task);
      }

      // Add event to task
      task.addEvent(msg);
      this.taskStore.update(task);

      // Broadcast to all subs and the from-service
      const broadcastTo = this._findSubs(task.action);
      if (!broadcastTo.includes(task.fromService)) broadcastTo.push(task.fromService);
      broadcastTo.forEach((subService) => {
        this._sendMessage(subService, 'ok', task.getLastEvent());
      });
    }).call(this);
  }

  _findSubs(action) {
    return this.subs[action] || [];
  }
}

Server.defaultLogger = console;

module.exports = Server;
