const { EventEmitter } = require('events');
const net = require('net');
const os = require('os');

class TcpListener extends EventEmitter {
  constructor ({ port } = {}) {
    super();

    this.proto = 'tcp';
    this.port = port;
    this.sockets = [];
  }

  get urls () {
    let result = [];
    Object.values(os.networkInterfaces()).forEach(ifaces => {
      ifaces.forEach(iface => {
        if (iface.family === 'IPv6') return;
        if (iface.address.startsWith('127.')) return;
        result.push(`tcp://${iface.address}:${this.port}`);
      });
    });
    return result;
  }

  up () {
    let server = net.createServer(socket => {
      socket.on('close', () => {
        let index = this.sockets.indexOf(socket);
        if (index !== -1) {
          this.sockets.splice(index, 1);
        }
      });
      this.sockets.push(socket);
      this.emit('socket', socket);
    });

    server.listen(this.port, () => {
      this.port = server.address().port;
    });
    this._server = server;
  }

  down () {
    return new Promise(resolve => {
      this.sockets.forEach(socket => socket.destroy());
      this._server.close(resolve);
      this._server = null;
    });
  }
}

module.exports = { TcpListener };
