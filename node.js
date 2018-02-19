const { EventEmitter } = require('events');
const { Identity } = require('./identity');
const { Connection } = require('./connection');

class Node extends EventEmitter {
  constructor ({ identity } = {}) {
    super();

    this.identity = identity || Identity.generate();
    this.listeners = [];
    this.dialers = [];
    this.finders = [];
    this.connections = [];
  }

  get address () {
    return this.identity.address;
  }

  get advertisement () {
    let { address, pubKey } = this.identity;
    let timestamp = new Date();
    let urls = this.listeners.reduce((result, listener) => {
      listener.urls.forEach(url => result.push(url));
      return result;
    }, []);
    return { address, pubKey, urls, timestamp };
  }

  addListener (listener) {
    listener.on('socket', async socket => {
      try {
        await this._connect(socket);
      } catch (err) {
        console.warn('Got ill-form socket,', err.message);
      }
    });
    this.listeners.push(listener);
  }

  addDialer (dialer) {
    this.dialers.push(dialer);
  }

  addFinder (finder) {
    this.finders.push(finder);
  }

  find (address) {
    return new Promise((resolve, reject) => {
      let timeout = setTimeout(() => reject(new Error('Find timeout')), 1000);
      this.finders.forEach(async finder => {
        try {
          let peer = await finder.find(address);
          clearTimeout(timeout);
          resolve(peer);
        } catch (err) {
          console.warn('Finder caught error', err);
        }
      });
    });
  }

  dial (url) {
    let [ proto ] = url.split(':');
    let dialer = this.dialers.find(dialer => dialer.name === proto);
    return dialer.dial(url, this);
  }

  async _connect (socket) {
    let { identity, advertisement } = this;
    let connection = new Connection({ identity, socket });
    try {
      await connection.handshake(advertisement);
      this.connections.push(connection);
      this.emit('connection', connection);
      return connection;
    } catch (err) {
      connection.end();
      throw err;
    }
  }

  async connect (url) {
    if (url.includes(':')) {
      let socket = await this.dial(url);
      let connection = await this._connect(socket);
      return connection;
    } else {
      throw new Error('Unimplemented connect with address yet');
    }
  }
}

module.exports = { Node };
