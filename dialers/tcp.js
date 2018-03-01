const net = require('net');
const { URL } = require('url');

class TcpDialer {
  constructor () {
    this.proto = 'tcp';
  }

  dial (url) {
    return new Promise((resolve, reject) => {
      let urlO = new URL(url);
      let socket = net.connect(urlO.port, urlO.hostname, () => resolve(socket));
    });
  }
}

module.exports = TcpDialer;
