const { EventEmitter } = require('events');
const { Identity } = require('./identity');
const { Connection } = require('./connection');
const { Registry } = require('./registry');
const assert = require('assert');

class Node extends EventEmitter {
  constructor ({ identity } = {}) {
    super();

    this.identity = identity || Identity.generate();
    this.listeners = [];
    this.dialers = [];
    this.registry = new Registry();
    this.connections = [];

    this._onConnectionData = this._onConnectionData.bind(this);
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

  _onConnectionData (data) {
    if (data.to !== this.identity.address) {
      console.warn('Invalid destination');
      return;
    }

    this.emit('message', data);
  }

  addListener (listener) {
    listener.on('socket', this._incomingSocket.bind(this));
    this.listeners.push(listener);
  }

  addDialer (dialer) {
    this.dialers.push(dialer);
  }

  addFinder (finder) {
    this.registry.addFinder(finder);
  }

  async start () {
    await Promise.all(this.listeners.map(listener => listener.up()));
    await this.registry.up();
  }

  async stop () {
    await this.registry.down();
    await Promise.all(this.listeners.map(listener => listener.down()));
  }

  find (address, options) {
    return this.registry.find(address, options);
  }

  dial (url) {
    let [ proto ] = url.split(':');
    let dialer = this.dialers.find(dialer => dialer.proto === proto);
    if (!dialer) {
      throw new Error(`No suitable dialer for ${url}`);
    }

    return dialer.dial(url);
  }

  async _connect (socket) {
    let { identity, advertisement } = this;
    let connection = new Connection({ identity, socket });
    try {
      let peerAdv = await connection.handshake(advertisement);

      // when connection to address already exist
      let oldConnection = this.connections.find(connection => connection.peerIdentity.address === peerAdv.address);
      if (oldConnection) {
        connection.destroy();
        connection = oldConnection;
      } else {
        this.connections.push(connection);
        connection.on('data', this._onConnectionData);
        this.emit('connection', connection);
      }

      await this.registry.put(peerAdv);
      return connection;
    } catch (err) {
      connection.destroy();
      throw err;
    }
  }

  async connect (url) {
    if (url.includes(':')) {
      let socket = await this.dial(url);
      return this._connect(socket);
    }

    let address = url;
    let connection = this.connections.find(connection => connection.peerIdentity.address === address);
    if (connection) {
      return connection;
    }

    let peer = await this.registry.find(address);
    let urls = peer.getEligibleUrls(this);
    for (let url of urls) {
      try {
        return this.connect(url);
      } catch (err) {
        console.warn(`Failed to connect to ${url}`);
      }
    }

    throw new Error(`Failed to connect to address ${address}`);
  }

  async send (to, message) {
    assert.notEqual(to, this.identity.address, 'Identity destination');

    let connection = await this.connect(to);
    connection.write(message);
  }

  broadcast (message) {
    this.connections.forEach(connection => {
      connection.write(message);
    });
  }

  async _incomingSocket (socket) {
    try {
      await this._connect(socket);
    } catch (err) {
      console.warn('Got ill-form socket,', err.message);
    }
  }
}

module.exports = { Node };
