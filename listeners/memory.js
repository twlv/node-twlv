const assert = require('assert');
const { EventEmitter } = require('events');

const listeners = [];

class MemoryListener extends EventEmitter {
  static getListener (address) {
    return listeners.find(listener => listener.node.address === address);
  }

  static reset () {
    listeners.splice(0);
  }

  constructor (node) {
    super();

    this.proto = 'memory';
    this.node = node;
    this._upped = false;

    listeners.push(this);
  }

  get urls () {
    return [ `memory:${this.node.address}` ];
  }

  up () {
    listeners.push(this);
    this._upped = true;
  }

  down () {
    this._upped = false;

    let index = listeners.indexOf(this);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }

  _incoming (socket) {
    assert(this._upped, 'Cannot bind down peer');

    this.emit('socket', socket);
  }
}

module.exports = MemoryListener;
