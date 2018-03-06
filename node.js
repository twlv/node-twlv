const { EventEmitter } = require('events');
const { Identity } = require('./identity');
const { Connection } = require('./connection');
const { Registry } = require('./registry');
const assert = require('assert');

class Node extends EventEmitter {
  constructor ({ identity } = {}) {
    super();

    this.identity = identity || Identity.generate();
    this.running = false;
    this.listeners = [];
    this.dialers = [];
    this.registry = new Registry();
    this.connections = [];
  }

  get advertisement () {
    // do not advertise when node is not running
    if (!this.running) {
      return;
    }

    let { address, pubKey } = this.identity;
    let timestamp = new Date();
    let urls = this.listeners.reduce((result, listener) => {
      listener.urls.forEach(url => result.push(url));
      return result;
    }, []);
    return { address, pubKey, urls, timestamp };
  }

  async generate () {
    assert(!this.running, 'Cannot generate identity on running node');

    this.identity = await Identity.generate();
  }

  authenticate (identity) {
    assert(!this.running, 'Cannot authenticate on running node');

    this.identity = identity;
  }

  deauthenticate () {
    assert(!this.running, 'Cannot deauthenticate on running node');

    this.identity = null;
  }

  addListener (listener) {
    assert(!this.running, 'Cannot add listener on running node');

    listener.on('socket', this._incomingSocket.bind(this));
    this.listeners.push(listener);
  }

  addDialer (dialer) {
    assert(!this.running, 'Cannot add dialer on running node');

    this.dialers.push(dialer);
  }

  addFinder (finder) {
    assert(!this.running, 'Cannot add finder on running node');

    this.registry.addFinder(finder);
  }

  async start () {
    assert(!this.running, 'Cannot start already running node');

    this.running = true;
    this.connections = [];

    await Promise.all(this.listeners.map(listener => listener.up(this)));
    await this.registry.up(this);
  }

  async stop () {
    assert(this.running, 'Cannot stop stopped node');

    await this.registry.down();
    await Promise.all(this.listeners.map(listener => listener.down()));

    this.connections.forEach(connection => connection.destroy());
    this.running = false;
  }

  find (address, options) {
    assert(this.running, 'Cannot find on stopped node');

    return this.registry.find(address, options);
  }

  dial (url) {
    assert(this.running, 'Cannot dial on stopped node');

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
    connection.on('close', () => {
      let index = this.connections.indexOf(connection);
      if (index !== -1) {
        this.connections.splice(index, 1);
      }
    });
    try {
      let peerAdv = await connection.handshake(advertisement);

      // when connection to address already exist
      let oldConnection = this.connections.find(connection => connection.peerIdentity.address === peerAdv.address);
      if (oldConnection) {
        connection.destroy();
        connection = oldConnection;
      } else {
        this.connections.push(connection);
        connection.on('data', this._onConnectionData.bind(this));
        this.emit('connection', connection);
      }

      await this.registry.put(peerAdv);
      return connection;
    } catch (err) {
      connection.destroy();
      throw err;
    }
  }

  connect (url) {
    assert(this.running, 'Cannot connect on stopped node');

    if (url.includes(':')) {
      return this._connectByUrl(url);
    }

    return this._connectByAddress(url);
  }

  async _connectByUrl (url) {
    return this._connect(await this.dial(url));
  }

  async _connectByAddress (address) {
    let connection = this.connections.find(connection => connection.peerIdentity.address === address);
    if (connection) {
      return connection;
    }

    let peer = await this.registry.get(address);
    if (peer) {
      let connection = await this._connectByPeer(peer);
      if (connection) {
        return connection;
      }

      await this.registry.invalidate(peer);
    }

    peer = await this.registry.find(address);
    connection = await this._connectByPeer(peer);
    if (connection) {
      return connection;
    }

    throw new Error(`Failed connect to address ${address}`);
  }

  async _connectByPeer (peer) {
    let urls = peer.getEligibleUrls(this);
    for (let url of urls) {
      try {
        let connection = await this.connect(url);
        if (connection.peerIdentity.address !== peer.address) {
          connection.destroy();
          throw new Error('Connect to invalid peer address ' + peer.address);
        }
        return connection;
      } catch (err) {
        this.emit('log:error', err);
      }
    }
  }

  async send (to, message) {
    assert(this.running, 'Cannot send on stopped node');

    assert.notEqual(to, this.identity.address, 'Identity destination');

    let connection = await this.connect(to);
    connection.write(message);
  }

  broadcast (message) {
    assert(this.running, 'Cannot broadcast on stopped node');

    this.connections.forEach(connection => {
      connection.write(message);
    });
  }

  _onConnectionData (data) {
    if (data.to !== this.identity.address) {
      console.warn('Invalid destination');
      return;
    }

    this.emit('message', data);
  }

  async _incomingSocket (socket) {
    try {
      await this._connect(socket);
    } catch (err) {
      this.emit('log:error', err);
    }
  }
}

module.exports = { Node };
