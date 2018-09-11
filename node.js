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
    this.receivers = [];
    this.dialers = [];
    this.handlers = [];
    this.registry = new Registry(this);
    this.connections = [];

    this._incomingSocket = this._incomingSocket.bind(this);
    this._onConnectionMessage = this._onConnectionMessage.bind(this);
  }

  get shortAddress () {
    return this.identity.address.substr(0, 4);
  }

  get advertisement () {
    // do not advertise when node is not running
    if (!this.running) {
      throw new Error('No advertisement on stopped node');
    }

    let { networkId } = this;
    let { address, pubKey } = this.identity;
    let timestamp = new Date();
    let urls = this.receivers.reduce((result, receiver) => {
      receiver.urls.forEach(url => result.push(url));
      return result;
    }, []);
    return { networkId, address, pubKey, urls, timestamp };
  }

  async addReceiver (receiver) {
    receiver.on('socket', this._incomingSocket);
    this.receivers.push(receiver);

    if (debug.enabled) debug('%s Receiver %s added', this.shortAddress, receiver.proto);

    if (this.running) {
      await this._receiverUp(receiver);
    }
  }

  async addDialer (dialer) {
    this.dialers.push(dialer);

    if (debug.enabled) debug('%s Dialer %s added', this.shortAddress, dialer.proto);

    if (this.running) {
      await this._dialerUp(dialer);
    }
  }

  async addFinder (finder) {
    await this.registry.addFinder(finder);
  }

  addHandler (handler) {
    this.handlers.push(handler);

    if (debug.enabled) debug('%s Handler %s added', this.shortAddress, getHandlerName(handler));
  }

  async removeReceiver (receiver) {
    if (this.running) {
      await this._receiverDown(receiver);
    }

    receiver.removeListener('socket', this._incomingSocket);

    if (debug.enabled) debug('%s Receiver %s removed', this.shortAddress, receiver.proto);

    let index = this.receivers.indexOf(receiver);
    if (index !== -1) {
      this.receivers.splice(index, 1);
    }
  }

  async removeDialer (dialer) {
    if (this.running) {
      await this._dialerDown(dialer);
    }

    if (debug.enabled) debug('%s Dialer %s removed', this.shortAddress, dialer.proto);

    let index = this.dialers.indexOf(dialer);
    if (index !== -1) {
      this.dialers.splice(index, 1);
    }
  }

  async removeFinder (finder) {
    await this.registry.removeFinder(finder);
  }

  removeHandler (handler) {
    let index = this.handlers.indexOf(handler);
    if (index !== -1) {
      this.handlers.splice(index, 1);
    }

    if (debug.enabled) debug('%s Handler %s removed', this.shortAddress, getHandlerName(handler));
  }

  async start () {
    if (this.running) {
      throw new Error('Cannot start already running node');
    }

    this.running = true;
    this.connections = [];

    await Promise.all(this.dialers.map(dialer => this._dialerUp(dialer)));
    await Promise.all(this.receivers.map(receiver => this._receiverUp(receiver)));
    await this.registry.up();

    if (debug.enabled) debug('%s Node started', this.shortAddress);
  }

  async stop () {
    if (!this.running) {
      throw new Error('Cannot stop stopped node');
    }

    while (this.connections.length) {
      let con = this.connections[0];
      await new Promise((resolve, reject) => {
        try {
          con.on('close', resolve);
          con.destroy();
        } catch (err) {
          reject(err);
        }
      });
    }
    // this.connections.forEach(connection => connection.destroy());

    await this.registry.down();
    await Promise.all(this.receivers.map(receiver => this._receiverDown(receiver)));
    await Promise.all(this.dialers.map(dialer => this._dialerDown(dialer)));

    this.running = false;

    if (debug.enabled) debug('%s Node stopped', this.shortAddress);
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

  async _connectBySocket (socket) {
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

  async connect (addressOrUrl) {
    if (!this.running) {
      throw new Error('Cannot connect on stopped node');
    }

    let connection = addressOrUrl.includes(':')
      ? await this._connectByUrl(addressOrUrl)
      : await this._connectByAddress(addressOrUrl);

    if (debug.enabled) debug('%s Connected peer %s', this.shortAddress, connection.peer.address);

    return connection;
  }

  async _connectByUrl (url) {
    let connection = await this._connectBySocket(await this.dial(url));
    return connection;
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
        let connection = await this._connectByUrl(url);
        if (connection.peer.address !== peer.address) {
          connection.destroy();
          throw new Error('Connect to invalid peer address ' + peer.address);
        }
        return connection;
      } catch (err) {
        if (debug.enabled) debug(`Node#_connectByPeer caught: ${err.stack}`);
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

    if (debug.enabled) debug('%s Message sent to %s', this.shortAddress, message.to);
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

  async _onConnectionMessage (message) {
    try {
      message.decrypt(this.identity);

      let handler = this.handlers.find(handler => this._testHandler(handler, message));
      if (handler) {
        await handler.handle(message, this);
        return;
      }

      this.emit('message', message);
    } catch (err) {
      if (debug.enabled) debug(`Node#_onConnectionMessage() caught: ${err.stack}`);
    }
  }

  _testHandler (handler, message) {
    if (typeof handler.test === 'string') {
      return message.command === handler.test;
    }

    if (handler.test instanceof RegExp) {
      return Boolean(message.command.match(handler.test));
    }

    if (typeof handler.test === 'function') {
      return handler.test(message);
    }

    throw new Error('Unsupported handler');
  }

  async _incomingSocket (socket) {
    try {
      await this._connectBySocket(socket);
    } catch (err) {
      if (debug.enabled) debug(`Node#_incomingSocket() caught: ${err.stack}`);
    }
  }

  async _dialerUp (dialer) {
    await dialer.up(this);

    if (debug.enabled) debug('%s Dialer %s up', this.shortAddress, dialer.proto);
  }

  async _dialerDown (dialer) {
    await dialer.down(this);

    if (debug.enabled) debug('%s Dialer %s up', this.shortAddress, dialer.proto);
  }

  async _receiverUp (receiver) {
    await receiver.up(this);

    if (debug.enabled) debug('%s Receiver %s up', this.shortAddress, receiver.proto);
  }

  async _receiverDown (receiver) {
    await receiver.down(this);

    if (debug.enabled) debug('%s Receiver %s up', this.shortAddress, receiver.proto);
  }
}

function getHandlerName (handler) {
  if (handler.name) {
    return handler.name;
  }

  if (typeof handler.test === 'string') {
    return handler.test;
  }

  if (handler.test instanceof RegExp) {
    return `regexp:${handler.test}`;
  }

  if (typeof handler.test === 'function') {
    return `fn:${handler.test.name}`;
  }
}

module.exports = { Node };
