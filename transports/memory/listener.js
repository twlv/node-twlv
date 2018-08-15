const { EventEmitter } = require('events');

const listeners = [];

class MemoryListener extends EventEmitter {
  static getListener (address) {
    return listeners.find(listener => listener.node.identity.address === address);
  }

  static reset () {
    listeners.splice(0);
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

    listeners.push(this);
  }

  down () {
    let index = listeners.indexOf(this);
    if (index !== -1) {
      listeners.splice(index, 1);
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

module.exports = { MemoryListener };
