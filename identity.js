const RSA = require('node-rsa');
const sha3256 = require('js-sha3').sha3_256;

const DEFAULT_KEY_SIZE = 512;

class Identity {
  static generate ({ b = DEFAULT_KEY_SIZE } = {}) {
    let rsa = new RSA({ b });
    return new Identity(rsa.exportKey('private'));
  }

  constructor (key) {
    this.key = key;
    this.address = sha3256(this.pubKey).slice(-20);
  }

  get rsa () {
    return new RSA(this.key);
  }

  get privKey () {
    return this.rsa.exportKey('private');
  }

  get pubKey () {
    return this.rsa.exportKey('public');
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
