const assert = require('assert');
const { EventEmitter } = require('events');

const listeners = [];

class MemoryListener extends EventEmitter {
  static getListener (address) {
    return listeners.find(listener => listener.address === address);
  }

  static reset () {
    listeners.splice(0);
  }

  constructor ({ address }) {
    super();

    assert(address, 'Address unspecified');

    this.proto = 'memory';
    this.address = address;

    listeners.push(this);
  }

  get urls () {
    return [ `memory:${this.address}` ];
  }

  up () {
    listeners.push(this);
  }

  down () {
    let index = listeners.indexOf(this);
    if (index !== -1) {
      listeners.splice(index, 1);
    }
  }
}

module.exports = MemoryListener;
