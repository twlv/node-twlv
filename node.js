const { EventEmitter } = require('events');
const { Identity } = require('./identity');
const { Connection } = require('./connection');
const { Registry } = require('./registry');
const { Message, MODE_SIGNED, MODE_ENCRYPTED } = require('./message');
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

    return dialer.dial(url, this);
  }

  async _connect (socket) {
    let connection = new Connection({ socket });
    connection.on('close', () => {
      let index = this.connections.indexOf(connection);
      if (index !== -1) {
        this.connections.splice(index, 1);
      }
    });
    try {
      let peer = await connection.handshake(this);
      // when connection to address already exist
      let oldConnection = this.connections.find(connection => connection.peer.address === peer.address);
      if (oldConnection) {
        connection.destroy();
        connection = oldConnection;
      } else {
        this.connections.push(connection);
        connection.on('data', this._onConnectionMessage.bind(this));
        this.emit('connection', connection);
      }

      await this.registry.put(peer);
      return connection;
    } catch (err) {
      connection.destroy();
      throw err;
    }
  }

  async connect (url) {
    assert(this.running, 'Cannot connect on stopped node');

    if (url.includes(':')) {
      return this._connect(await this.dial(url));
    }

    return this._connectByAddress(url);
  }

  async _connectByAddress (address) {
    let connection = this.connections.find(connection => connection.peer.address === address);
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
        if (connection.peer.address !== peer.address) {
          connection.destroy();
          throw new Error('Connect to invalid peer address ' + peer.address);
        }
        return connection;
      } catch (err) {
        console.error(err);
        this.emit('log:error', err);
      }
    }
  }

  async send (message) {
    assert(this.running, 'Cannot send on stopped node');

    assert(message.to && message.to !== this.identity.address, 'Invalid to value');

    let connection = await this.connect(message.to);

    message = Message.from(message);
    message.from = this.identity.address;

    message.encrypt(connection.peer);
    message.sign(this.identity);

    connection.write(message);
  }

  async relay (message) {
    assert(this.running, 'Cannot send on stopped node');

    assert(message.to && message.to !== this.identity.address, 'Invalid to value');

    let ttl = message.ttl > 1 ? message.ttl : 10;
    message.ttl = 1;

    message = Message.from(message);
    message.from = this.identity.address;

    let peer = await this.find(message.to);
    assert(peer, 'Relay message needs peer to encrypt');

    message.encrypt(peer);
    message.sign(this.identity);

    // let connection = this.connections.find(connection => connection.peer.address === message.to);
    // if (connection) {
    //   connection.write(message);
    //   return;
    // }

    this.broadcast({
      mode: 0,
      from: this.identity.address,
      command: 'relay',
      payload: message.getBuffer(),
      ttl,
    });
  }

  broadcast (message, excludes = []) {
    assert(this.running, 'Cannot broadcast on stopped node');

    message = Message.from(message);
    message.from = this.identity.address;

    this.connections.forEach(connection => {
      let peerMessage = message.clone();
      peerMessage.to = connection.peer.address;
      peerMessage.encrypt(connection.peer);
      peerMessage.sign(this.identity);
      connection.write(peerMessage);
    });
  }

  async _onConnectionMessage (message) {
    try {
      message.decrypt(this.identity);

      if (message.command === 'relay') {
        let packet = Message.fromBuffer(message.payload);
        if (packet.from === this.identity.address) {
          return;
        }

        if (packet.to !== this.identity.address) {
          return this.broadcast(message, [ message.from, packet.from ]);
        }

        let peer = await this.find(packet.from);
        assert(peer, 'Relay message needs peer to verify');

        packet.verify(peer);
        packet.decrypt(this.identity);
        packet.ttl--;

        return this.emit('message', packet);
      }

      this.emit('message', message);
    } catch (err) {
      console.error(err);
    }
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
