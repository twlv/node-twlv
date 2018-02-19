const { URL } = require('url');
const { MemorySocket, getListener } = require('../listeners/memory');

class MemoryDialer {
  constructor (node) {
    this.name = 'memory';
    this.node = node;
  }

  dial (url) {
    url = new URL(url);

    let socket = new MemorySocket();

    let listener = getListener(url.pathname);
    listener._incoming(socket);

    return socket;
  }
}

module.exports = { MemoryDialer };
