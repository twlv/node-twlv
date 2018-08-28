const { EventEmitter } = require('events');
const { Identity } = require('./identity');
const { Connection } = require('./connection');
const { Registry } = require('./registry');
const { Message } = require('./message');
const debug = require('debug')('twlv:core:node');

class Node extends EventEmitter {
  constructor ({ networkId = 'twlv', identity } = {}) {
    super();

    this.networkId = networkId;
    this.identity = identity || Identity.generate();
    this.running = false;
    this.listeners = [];
    this.dialers = [];
    this.registry = new Registry(networkId);
    this.connections = [];

    this._incomingSocket = this._incomingSocket.bind(this);
    this._onConnectionMessage = this._onConnectionMessage.bind(this);
  }

  get advertisement () {
    // do not advertise when node is not running
    if (!this.running) {
      return;
    }

    let { networkId } = this;
    let { address, pubKey } = this.identity;
    let timestamp = new Date();
    let urls = this.listeners.reduce((result, listener) => {
      listener.urls.forEach(url => result.push(url));
      return result;
    }, []);
    return { networkId, address, pubKey, urls, timestamp };
  }

  // DEPRECATED
  // async generate () {
  //   if (this.running) {
  //     throw new Error('Cannot generate identity on running node');
  //   }

  //   this.identity = await Identity.generate();
  // }

  // authenticate (identity) {
  //   if (this.running) {
  //     throw new Error('Cannot authenticate on running node');
  //   }

  //   this.identity = identity;
  // }

  // deauthenticate () {
  //   if (this.running) {
  //     throw new Error('Cannot deauthenticate on running node');
  //   }

  //   this.identity = null;
  // }

  addListener (listener) {
    if (this.running) {
      throw new Error('Cannot add listener on running node');
    }

    listener.on('socket', this._incomingSocket);
    this.listeners.push(listener);
  }

  addDialer (dialer) {
    if (this.running) {
      throw new Error('Cannot add dialer on running node');
    }

    this.dialers.push(dialer);
  }

  addFinder (finder) {
    if (this.running) {
      throw new Error('Cannot add finder on running node');
    }

    this.registry.addFinder(finder);
  }

  async start () {
    if (this.running) {
      throw new Error('Cannot start already running node');
    }

    this.running = true;
    this.connections = [];

    await Promise.all(this.dialers.map(dialer => typeof dialer.up === 'function' ? dialer.up(this) : undefined));
    await Promise.all(this.listeners.map(listener => listener.up(this)));
    await this.registry.up(this);
  }

  async stop () {
    if (!this.running) {
      throw new Error('Cannot stop stopped node');
    }

    this.connections.forEach(connection => connection.destroy());

    await this.registry.down();
    await Promise.all(this.listeners.map(listener => listener.down()));
    await Promise.all(this.dialers.map(dialer => typeof dialer.down === 'function' ? dialer.down() : undefined));

    this.running = false;
  }

  find (address, options) {
    if (!this.running) {
      throw new Error('Cannot find on stopped node');
    }

    return this.registry.find(address, options);
  }

  dial (url) {
    if (!this.running) {
      throw new Error('Cannot dial on stopped node');
    }

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
        connection.on('data', this._onConnectionMessage);
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
    if (!this.running) {
      throw new Error('Cannot connect on stopped node');
    }

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
        debug(`Node#_connectByPeer caught: ${err.stack}`);
      }
    }
  }

  async send (message) {
    if (!this.running) {
      throw new Error('Cannot send on stopped node');
    }

    if (!message.to || message.to === this.identity.address) {
      throw new Error('Invalid to value');
    }

    let connection = await this.connect(message.to);

    message = Message.from(message);
    message.from = this.identity.address;

    message.encrypt(connection.peer);
    message.sign(this.identity);

    connection.write(message);
  }

  broadcast (message, excludes = []) {
    if (!this.running) {
      throw new Error('Cannot broadcast on stopped node');
    }

    message = Message.from(message);
    message.from = this.identity.address;

    this.connections.forEach(connection => {
      if (excludes.indexOf(connection.peer.address) !== -1) {
        return;
      }

      let peerMessage = message.clone();
      peerMessage.to = connection.peer.address;
      peerMessage.encrypt(connection.peer);
      peerMessage.sign(this.identity);
      connection.write(peerMessage);
    });
  }

  _onConnectionMessage (message) {
    try {
      message.decrypt(this.identity);

      this.emit('message', message);
    } catch (err) {
      debug(`Node#_onConnectionMessage() caught: ${err.stack}`);
    }
  }

  async _incomingSocket (socket) {
    try {
      await this._connect(socket);
    } catch (err) {
      debug(`Node#_incomingSocket() caught: ${err.stack}`);
    }
  }
}

module.exports = { Node };
