/* eslint class-methods-use-this: ["error", { "exceptMethods": ["_sendMessageToClient"] }] */

const WebSocket = require('ws');
const ServerTask = require('./ServerTask');

class Server {
  constructor(opts) {
    const defaultOpts = {
      port: 8080,
      verifyClient: this._verfyClient.bind(this)
    };
    this.logger = console;
    this.opts = { ...defaultOpts, ...opts };
    this.server = null;
    this.address = null;
    this.credentials = {};
    this.clients = [];

    // subs
    this.subs = {};
    // Task store, will be moved to Redis or MongoDB in the future
    this.tasks = {};
  }

  start() {
    this.server = new WebSocket.Server(this.opts);
    this.logger.info('Starting server at:', this.server.address().port);
    this.server.on('connection', this._initClient.bind(this));
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
    this.logger.log(`Credentials added for '${service}' service.`);
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
        this._execMessage(serviceName, client, data);
      } catch (e) {
        this.logger.log('Invalid message:', e.message, data);
        this._sendMessageToClient(client, 'error', { error: e.name, message: e.message, request: data });
      }
    });
  }

  // Send messages
  _sendMessage(serviceName, status, msg) {
    this._getClientsFor(serviceName).forEach((client) => {
      this._sendMessageToClient(client, status, msg);
    });
  }

  _sendMessageToClient(client, status, msg) {
    if (!['ok', 'error'].includes(status)) throw new RangeError('Status must be either: ok or error.');
    client.send(JSON.stringify({ status, ...msg }));
  }

  // Handle messages
  _execMessage(serviceName, client, rawMsg) {
    const msg = Server._parseMessage(rawMsg);
    switch (msg.type) {
      case 'pub': return this._execPubMessage(serviceName, client, msg);
      case 'sub': return this._execSubAction(serviceName, client, msg);
      default:
        throw new TypeError(`Unsupported message type: ${msg.type}`);
    }
  }

  static _parseMessage(rawData) {
    const json = JSON.parse(rawData);
    if (!json.type) {
      throw new TypeError('Missing message type.');
    }
    return json;
  }


  // Subscribe tasks
  _execSubAction(serviceName, client, msg) {
    if (!Object.prototype.hasOwnProperty.call(msg, 'action')) {
      throw new TypeError('Sub messages must have props: action.');
    }
    this._addSub(msg.action, serviceName);
    this._sendMessageToClient(client, 'ok', { message: `Client subscribed to ${msg.action}.` });
  }

  _addSub(action, serviceName) {
    if (!this.subs[action]) this.subs[action] = [];
    if (this.subs[action].includes(serviceName)) return;
    this.subs[action].push(serviceName);
  }


  // Publish messages
  _execPubMessage(serviceName, client, msg) {
    if (!ServerTask.validateMessage(msg)) return;

    const task = this.tasks[msg.id] || new ServerTask(msg.id, msg.action, msg.payload);
    task.addMessage(msg);

    this._findSubs(msg.action).forEach((subService) => {
      this._sendMessage(subService, 'ok', {
        id: msg.id,
        action: task.action,
        payload: task.payload,
        event: task.lastEvent,
        result: task.result
      });
    });
  }
  _findSubs(action) {
    return this.subs[action] || [];
  }
}

module.exports = Server;
