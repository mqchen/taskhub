const WebSocket = require('ws');
const ClientTask = require('./ClientTask');

class Client {
  constructor(url, service, key) {
    this.url = url;
    this.ws = new WebSocket(url, 'ws', {
      headers: { service, key }
    });
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
    return new ClientTask(action, payload);
  }

  sub(action, callback) {
    this.ws.send(JSON.stringify({
      task: 'sub',
      action
    }))
  }
}

Client.Task = ClientTask;

module.exports = Client;
