const WebSocket = require('ws');

class Server {
  constructor(opts) {
    const defaultOpts = {
      port: 8080,
      verifyClient: this._verfyClient.bind(this)
    };
    this.opts = { ...defaultOpts, ...opts };
    this.server = null;
    this.credentials = {};
    this.clients = {};

    // Message store (will be moved to Redis or MongoDB)
    this.messages = [];
  }

  start() {
    this.server = new WebSocket.Server(this.opts);
    console.log('Starting server at:', this.server.address().port);
    this.server.on('connection', this._initClient.bind(this));
    return this.server.address();
  }

  stop() {
    if (this.server) this.server.close();
  }

  addCredential(service, creds) {
    console.log(`Credentials added for '${service}' service.`);
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
    client.send(JSON.stringify({ status, ...obj }));
  }

  _initClient(client) {
    client.on('message', (data) => {
      try {
        const msg = Server._parseMessage(data);
        this._execMessage(client, msg);
      } catch (e) {
        console.log('Invalid message:', e.message, data);
        Server._sendMessage(client, 'error', { error: e.name, message: e.message });
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
      case 'sub': return this._execSub(client, msg);
      default:
        throw new TypeError(`Unsupported message type: ${msg.type}`);
    }
  }

  _execPubTask(client, msg) {
    // Validate message
    if (!Object.prototype.hasOwnProperty.call(msg, 'action')
    || !Object.prototype.hasOwnProperty.call(msg, 'payload')) {
      throw new TypeError('Pub messages must have props: action, payload.');
    }

    // TODO: check if client is authenticated before executing tasks
  }

  _execSub(client, msg) {
    // TODO: check for auth before subbing to tasks
  }
}

module.exports = Server;
