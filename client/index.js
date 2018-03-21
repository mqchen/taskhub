const WebSocket = require('ws');

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
}

module.exports = Client;
