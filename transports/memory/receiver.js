const { EventEmitter } = require('events');

const receivers = [];

class MemoryReceiver extends EventEmitter {
  static getReceiver (address) {
    return receivers.find(receiver => receiver.node.identity.address === address);
  }

  static reset () {
    receivers.splice(0);
  }

  constructor () {
    super();

    this.proto = 'memory';
  }

  get urls () {
    return [ `memory:${this.node.identity.address}` ];
  }

  up (node) {
    this.node = node;

    receivers.push(this);
  }

  down () {
    let index = receivers.indexOf(this);
    if (index !== -1) {
      receivers.splice(index, 1);
    }

    this.node = undefined;
  }

  _incoming (socket) {
    if (!this.node) {
      throw new Error('Cannot bind down peer');
    }

    this.emit('socket', socket);
  }
}

module.exports = { MemoryReceiver };
