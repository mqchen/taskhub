const WebSocket = require('ws');
const basicAuth = require('basic-auth');
const Task = require('../common/task');
const ConsoleLogger = require('../common/consoleLogger');
const MemoryTaskStore = require('../common/stores/memory');

class Server {
  constructor(opts) {
    const defaultOpts = {
      port: 8080,
      verifyClient: this._verifyClient.bind(this),
      logger: Server.defaultLogger,
      // heartbeat: 5000 // check for dead clients every 30 sec
    };
    this.options = { ...defaultOpts, ...opts };
    this.logger = this.options.logger;
    this.taskStore = this.options.taskStore || new MemoryTaskStore();

    this.server = null;
    this.address = null;
    this.credentials = {};
    this.clients = {};
    this.subs = {};
    // this.heartbeatInterval = setInterval(
    //   this._cleanUpBrokenClients.bind(this),
    //   this.options.heartbeat
    // );
  }

  start() {
    this.server = new WebSocket.Server(this.options);
    this.logger.info('🔌 Starting server at:', this.server.address().port);
    this.server.on('connection', (...args) => this._initClient(...args));
    this.address = this.server.address();
    return this.address;
  }

  isRunning() {
    return !!this.address;
  }

  stop() {
    if (this.server) this.server.close();
    clearInterval(this.heartbeatInterval);
  }

  addCredentials(clientName, creds) {
    this.logger.info(`🔑 Credentials added for client: ${clientName}`);
    this.credentials[clientName] = creds;
  }

  removeCredentials(clientName) {
    delete this.credentials[clientName];
  }

  // Verify and init clients
  _verifyClient(info, cb) {
    const creds = basicAuth(info.req);
    const clientName = creds && creds.name ? decodeURIComponent(creds.name) : null;
    const key = creds && creds.pass ? decodeURIComponent(creds.pass) : null;
    if (clientName !== null && key !== null
      && this.credentials[clientName] && this.credentials[clientName].key === key) {
      cb(true);
      return;
    }
    this.logger.info('Unauthorized connection. Rejecting it.');
    cb(false, 401, 'Unauthorized');
  }

  _getClientsFor(clientName) {
    if (!this.clients[clientName]) this.clients[clientName] = [];
    return this.clients[clientName];
  }

  _initClient(client, req) {
    // Register client
    const creds = basicAuth(req);
    // const clientName = req.headers.client;
    const clientName = creds.name;

    // Heartbeat
    // eslint-disable-next-line no-param-reassign
    client.isAlive = true;
    client.on('pong', () => { this.isAlive = true; });

    // Register it
    this._getClientsFor(clientName).push(client);
    this.logger.info(`👋 New client for '${clientName}' authenticated. Total instances of this client: ${this.clients[clientName].length}`);

    // Register events
    client.on('message', (data, isBinary) => {
      const message = isBinary ? data : data.toString();
      try {
        this._execCommand(clientName, client, message);
      } catch (e) {
        this.logger.warn('Invalid message:', e.message, message);
        this._sendMessageToClient(client, 'error', { error: e.name, message: e.message, request: message });
      }
    });
  }

  // Check for dead clients and remove them
  // https://github.com/websockets/ws#how-to-detect-and-close-broken-connections
  // _cleanUpBrokenClients() {
  //   const newClients = {};
  //   Object.keys(this.clients).forEach((clientName) => {
  //     for (let i = 0; i < this.clients[clientName].length; i += 1) {
  //       const client = this.clients[clientName][i];
  //       if (!client) {
  //         // will not be added
  //         this.logger.info('❌ Client is not alive. Removing.', clientName);
  //       } else if (client.isAlive === false) {
  //         client.terminate();
  //         this.logger.info('❌ Client is not alive. Terminating and removing.', clientName);
  //       } else {
  //         client.isAlive = false;
  //         client.ping(() => {});
  //         if (!Object.prototype.hasOwnProperty.call(newClients, clientName)) {
  //           newClients[clientName] = [];
  //         }
  //         newClients[clientName].push(client);
  //       }
  //     }
  //   });
  //   this.clients = newClients;
  // }

  // Send messages
  _sendMessage(clientName, status, msg) {
    this.logger.info(`📤 Sending ${status} message to '${clientName}'.`, msg);
    this._getClientsFor(clientName).forEach((client) => {
      this._sendMessageToClient(client, status, msg);
    });
  }

  // eslint-disable-next-line class-methods-use-this
  _sendMessageToClient(client, status, msg) {
    if (!['ok', 'error'].includes(status)) throw new RangeError('Status must be either ok or error.');
    client.send(JSON.stringify({ status, ...msg }));
  }

  // Handle messages
  _execCommand(clientName, client, rawMsg) {
    const msg = Server._parseCommand(rawMsg);
    switch (msg.cmd) {
      case 'pub': return this._execPubCmd(clientName, client, msg);
      case 'sub': return this._execSubCmd(clientName, client, msg);
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
  _execSubCmd(clientName, fromClient, msg) {
    if (!Object.prototype.hasOwnProperty.call(msg, 'action')) {
      throw new TypeError('Sub messages must have props: action.');
    }
    this._addSub(msg.action, clientName);
    this._sendMessageToClient(fromClient, 'ok', { message: `Client subscribed to ${msg.action}.` });
  }

  _addSub(action, clientName) {
    if (!this.subs[action]) this.subs[action] = [];
    if (this.subs[action].includes(clientName)) return;
    this.subs[action].push(clientName);
    this.logger.info(`👂 '${clientName}' is now subscribed to action: ${action}.`);
  }

  // Publish messages
  _execPubCmd(clientName, client, msg) {
    if (!Object.prototype.hasOwnProperty.call(msg, 'taskId')) {
      throw new TypeError('Pub messages must have props: taskId.');
    }
    if (!Task.validateEvent(msg)) return; // It throws which is caught outside

    (async () => {
      // Get or create task from taskStore
      let task = await this.taskStore.get(msg.taskId);
      if (!task) {
        task = new Task(msg.taskId, clientName);
        this.taskStore.add(task);
      }

      // Add event to task
      task.addEvent(msg);
      this.taskStore.update(task);

      // Broadcast to all subs and the from-client
      const broadcastTo = this._findSubs(task.action);
      this.logger.info(`📣 Broadcasting '${task.action}' to ${broadcastTo.length} client(s).`);
      if (!broadcastTo.includes(task.fromClient)) broadcastTo.push(task.fromClient);
      broadcastTo.forEach((subClient) => {
        this._sendMessage(subClient, 'ok', task.getLastEvent());
      });
    }).call(this);
  }

  _findSubs(action) {
    return this.subs[action] || [];
  }
}

Server.defaultLogger = ConsoleLogger;

module.exports = Server;
