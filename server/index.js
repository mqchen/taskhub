const WebSocket = require('ws');
const Auth = require('./auth.js');

class Server {
  constructor(opts) {
    const defaultOpts = {
      port: 8080
    };
    this.server = new WebSocket.Server({ ...defaultOpts, ...opts });
    this.credentials = {};
    this.clients = {};
  }

  start() {
    console.log('Starting server.');
    this.server.on('connection', this._initClient.bind(this));
  }

  addCredential(service, creds) {
    this.credentials[service] = creds;
  }

  getCredentialFor(service) {
    return this.credentials[service];
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
      case 'auth': return this._execAuth(client, msg);
      // TODO: kick unauthorized clients after a little time
      // or if they send a non auth-message first.
      case 'pub': return this._execPubTask(client, msg);
      case 'sub': return this._execSub(client, msg);
      default:
        throw new TypeError(`Unsupported message type: ${msg.type}`);
    }
  }

  _execAuth(client, msg) {
    if (!Auth(this, client, msg)) {
      Server._sendMessage(client, 'error', { error: 'Error', message: 'Authentication failed.' });
      client.terminate();
    } else {
      this.clients[msg.name] = client;
      Server._sendMessage(client, 'ok');
    }
    // TODO: authenticate client. Kick if it fails.
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
