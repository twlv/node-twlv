const { getListener } = require('./listener').MemoryListener;
const { Duplex } = require('stream');

class MemoryDialer {
  constructor () {
    this.proto = 'memory';
  }

  dial (url) {
    let socket = new MemorySocket();
    let address = url.split(':').pop();
    let listener = getListener(address);

    if (!listener) {
      throw new Error(`Error dialing ${url}`);
    }

    listener._incoming(new MemorySocket(socket));

    return socket;
  }
}

class MemorySocket extends Duplex {
  constructor (peer) {
    super();

    if (peer) {
      this.peer = peer;
      peer.peer = this;
    }
  }

  _write (data, encoding, cb) {
    this.peer.push(data);
    cb();
  }

  _read () {
    // do nothing
  }

  _destroy (err, cb) {
    this.peer.destroy(err);
    cb(err);
  }
}

module.exports = { MemoryDialer };
