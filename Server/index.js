const WebSocket = require('ws');

class Server {
  constructor(opts) {
    const defaultOpts = {
      port: 8080
    };
    this.server = new WebSocket.Server({ ...defaultOpts, ...opts });

    this.server.on('connection', (client) => {
      client.send('Opened');

      client.on('message', (data) => {
        client.send(data);
        console.log(data);
      });
    });
  }

  start() {
    // A
  }
}

module.exports = Server;
