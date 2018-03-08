import WebSocket from 'ws';

class Server {
  constructor(opts) {
    const defaultOpts = {
      port: 8080
    };
    this.server = WebSocket.Server({ ...defaultOpts, ...opts });
  }
}

module.exports = Server;
