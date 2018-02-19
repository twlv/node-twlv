const { EventEmitter } = require('events');
const { Duplex } = require('stream');

const listeners = [];

class MemoryListener extends EventEmitter {
  constructor (node) {
    super();

    this.node = node;

    listeners.push(this);
  }

  get urls () {
    return [ `memory:${this.node.identity.address}` ];
  }

  _incoming (inbound) {
    let socket = new MemorySocket(inbound);
    this.emit('socket', socket);
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
}

function getListener (address) {
  return listeners.find(listener => listener.node.address === address);
}

function removeAllListeners () {
  listeners.splice(0);
}

module.exports = { MemoryListener, MemorySocket, getListener, removeAllListeners };
