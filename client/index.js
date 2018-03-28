const WebSocket = require('ws');
const uuid = require('uuid/v4');
const ClientTask = require('./ClientTask');

class Client {
  constructor(url, service, key) {
    this.url = url;
    this.ws = new WebSocket(url, 'ws', {
      headers: { service, key }
    });
    this.ws.on('message', this._processMessage.bind(this));
    this.subs = {};
    this.tasks = {};
    this.logger = console;
  }

  static async create(url, service, key) {
    return new Promise((resolve, reject) => {
      const client = new Client(url, service, key);
      client.ws.on('open', () => resolve(client));
      client.ws.on('close', () => reject(client));
    });
  }

  _processMessage(data) {
    this.logger.log('Message received:', data);
    const msg = JSON.parse(data);
    this._findSubs(msg.action).forEach((callback) => { callback.call(null, msg); });
  }

  isOpen() {
    return this.ws.readyState === WebSocket.OPEN;
  }

  pub(action, payload) {
    const id = uuid();
    this.ws.send(JSON.stringify({ type: 'pub', action, payload: payload || null, id, event: 'init' }));
    this.tasks[id] = new ClientTask(this, action, payload);
    return this.tasks[id];
  }

  _findSubs(action) {
    return this.subs[action] || [];
  }

  sub(action, callback) {
    if (!this.subs[action]) this.subs[action] = [];
    this.subs[action].push(callback);

    this.ws.send(JSON.stringify({ type: 'sub', action }));
  }
}

Client.Task = ClientTask;

module.exports = Client;
