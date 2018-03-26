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


  _verfyClient(info, cb) {
    const service = `${info.req.headers.service}`;
    const key = `${info.req.headers.key}`;

    if (this.credentials[service] && this.credentials[service].key === key) {
      cb(true);
      return;
    }
    cb(false, 401, 'Unauthorized');
  }

  static _sendMessage(client, status, obj) {
    if (!['ok', 'error'].includes(status)) throw new RangeError('Status must be either: ok or error.');
    client.send(JSON.stringify({ status, ...obj }));
  }

  _initClient(client) {
    this.clients.push(client);
    client.on('message', (data) => {
      try {
        const msg = Server._parseMessage(data);
        this._execMessage(client, msg);
      } catch (e) {
        this.logger.log('Invalid message:', e.message, data);
        Server._sendMessage(client, 'error', { error: e.name, message: e.message, request: data });
      }
    });
  }

  static _parseMessage(rawData) {
    const json = JSON.parse(rawData);
    if (!json.type) {
      throw new TypeError('Missing message type.');
    }
    return json;
  }

  _execMessage(client, msg) {
    switch (msg.type) {
      case 'pub': return this._execPubTask(client, msg);
      case 'sub': return this._execSubAction(client, msg);
      default:
        throw new TypeError(`Unsupported message type: ${msg.type}`);
    }
  }

  _findSubs(action) {
    return this.subs[action] || [];
  }

  _addSub(action, client) {
    // TODO: prevent duplicates
    if (!this.subs[action]) this.subs[action] = [];
    this.subs[action].push(client);
  }

  _execPubTask(client, msg) {
    if (!ServerTask.validateMessage(msg)) return;

    const task = this.tasks[msg.id] || new ServerTask(msg.id, msg.action, msg.payload);
    task.addMessage(msg);

    this._findSubs(msg.action).forEach((sub) => {
      Server._sendMessage(sub, 'ok', {
        id: msg.id,
        action: task.action,
        payload: task.payload,
        event: task.lastEvent,
        result: task.result
      });
    });
  }

  _execSubAction(client, msg) {
    if (!['action'].every(key => Object.prototype.hasOwnProperty.call(msg, key))) {
      throw new TypeError('Sub messages must have props: action.');
    }
    this._addSub(msg.action, client);
    Server._sendMessage(client, 'ok', { message: `Client subscribed to ${msg.action}.` });
  }
}

module.exports = Server;
