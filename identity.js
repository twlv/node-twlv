const RSA = require('node-rsa');
const sha3256 = require('js-sha3').sha3_256;

const DEFAULT_KEY_SIZE = 512;

class Identity {
  static generate ({ b = DEFAULT_KEY_SIZE } = {}) {
    let rsa = new RSA({ b });
    return new Identity(rsa.exportKey('private'));
  }

  constructor (key) {
    Object.defineProperty(this, 'rsa', {
      enumerable: false,
      writable: false,
      configurable: false,
      value: new RSA(key),
    });

    if (this.rsa.isPrivate()) {
      Object.defineProperty(this, 'privKey', {
        enumerable: false,
        writable: false,
        configurable: false,
        value: this.rsa.exportKey('private'),
      });
    }

    let pubKey = this.rsa.exportKey('public');
    Object.defineProperty(this, 'address', {
      enumerable: true,
      writable: false,
      configurable: false,
      value: sha3256(pubKey).slice(-20),
    });

    Object.defineProperty(this, 'pubKey', {
      enumerable: true,
      writable: false,
      configurable: false,
      value: pubKey,
    });
  }

  isPrivate () {
    return this.rsa.isPrivate();
  }

  sign (...args) {
    return this.rsa.sign(...args);
  }

  verify (...args) {
    return this.rsa.verify(...args);
  }

  encrypt (...args) {
    return this.rsa.encrypt(...args);
  }

  decrypt (...args) {
    return this.rsa.decrypt(...args);
  }
}

module.exports = { Identity };
