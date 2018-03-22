const WebSocket = require('ws');
const uuid = require('uuid/v4');
const ClientTask = require('./ClientTask');

class Client {
  constructor(url, service, key) {
    this.url = url;
    this.ws = new WebSocket(url, 'ws', {
      headers: { service, key }
    });
    this.subs = {};
    this.tasks = {};
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

  pub(action, payload) {
    const id = uuid();
    this.ws.send(JSON.stringify({ task: 'pub', action, payload, id, event: 'init' }));
    this.tasks[id] = new ClientTask(action, payload);
    return this.tasks[id];
  }

  sub(action, callback) {
    if (!this.subs[action]) this.subs[action] = [];
    this.subs[action].push(callback);

    this.ws.send(JSON.stringify({ task: 'sub', action }));
  }
}

Client.Task = ClientTask;

module.exports = Client;
