const { getReceiver } = require('./receiver').MemoryReceiver;
const { Duplex } = require('stream');

class MemoryDialer {
  constructor () {
    this.proto = 'memory';
  }

  up () {
    // noop
  }

  down () {
    // noop
  }

  dial (url) {
    let socket = new MemorySocket();
    let address = url.split(':').pop();
    let receiver = getReceiver(address);

    if (!receiver) {
      throw new Error(`Error dialing ${url}`);
    }

    receiver._incoming(new MemorySocket(socket));

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
