const lpstream = require('length-prefixed-stream');
const { Peer } = require('./peer');
const { Duplex } = require('stream');
const { Message, MODE_SIGNED, MODE_ENCRYPTED } = require('./message');

class Connection extends Duplex {
  constructor ({ socket }) {
    super({ objectMode: true, emitClose: false });

    this.socket = socket;

    this.encoder = lpstream.encode();
    this.decoder = lpstream.decode();

    this.encoder.pipe(this.socket).pipe(this.decoder);

    this._onSocketClose = this._onSocketClose.bind(this);
    this._onReadable = this._onReadable.bind(this);

    // event close better then end
    this.socket.on('end', this._onSocketClose);
    this.socket.on('close', this._onSocketClose);
  }

  async handshake (node) {
    try {
      let unit = this._handshaking = new HandshakingUnit(this, node);
      this.peer = new Peer(await unit.run());
      this.decoder.on('readable', this._onReadable);
      this._onReadable();
      return this.peer;
    } finally {
      this._handshaking = undefined;
    }
  }

  _onReadable () {
    let frame;
    while ((frame = this.decoder.read())) {
      let message = Message.fromBuffer(frame);
      message.verify(this.peer);
      this.push(message);
    }
  }

  _write (message, encoding, cb) {
    if (message instanceof Message === false) {
      throw new Error('Message must be instanceof Message');
    }

    this.encoder.write(message.getBuffer());
    cb();
  }

  _onSocketClose () {
    this.destroy();
  }

  _read () {
    // noop
  }

  _destroy (err, callback) {
    this.socket.removeListener('end', this._onSocketClose);
    this.socket.removeListener('close', this._onSocketClose);
    this.decoder.removeListener('readable', this._onReadable);

    this.socket.destroy();
    this.encoder.destroy();
    this.decoder.destroy();

    this.emit('close');

    callback(err);
  }
}

class HandshakingUnit {
  constructor (connection, node) {
    this.connection = connection;
    this.node = node;
    this._onReadable = this._onReadable.bind(this);
  }

  get local () {
    return this.node.identity;
  }

  get localAddress () {
    return this.local ? this.local.address : '';
  }

  get remoteAddress () {
    return this.remote ? this.remote.address : '';
  }

  get decoder () {
    return this.connection.decoder;
  }

  run () {
    return new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;

      this.decoder.on('readable', this._onReadable);

      this.send('handshake', JSON.stringify(this.node.advertisement), MODE_SIGNED);
    });
  }

  send (command, payload, mode = MODE_SIGNED | MODE_ENCRYPTED) {
    let { localAddress, remoteAddress } = this;
    let message = new Message({ from: localAddress, to: remoteAddress, mode, command, payload });

    message.encrypt(this.remote);
    message.sign(this.local);

    this.connection.write(message);
  }

  _onReadable () {
    let frame;
    while ((frame = this.decoder.read())) {
      try {
        let message = Message.fromBuffer(frame);
        if (message.command === 'handshake') {
          let advertisement = JSON.parse(message.payload);
          if (this.node.networkId !== advertisement.networkId) {
            throw new Error('Invalid network id');
          }
          this.remote = new Peer(advertisement);
          let nonce = this.nonce = Math.floor(Math.random() * 65536).toString(16);
          this.send('handshake-ack', JSON.stringify({ nonce }));
        } else {
          message.verify(this.remote);
          message.decrypt(this.local);

          if (message.command === 'handshake-ack') {
            let { nonce } = JSON.parse(message.payload);
            this.send('handshake-ack2', JSON.stringify({ nonce }));
          } else if (message.command === 'handshake-ack2') {
            let { nonce } = JSON.parse(message.payload);
            if (nonce !== this.nonce) {
              throw new Error('Invalid nonce');
            }

            this.decoder.removeListener('readable', this._onReadable);
            return this.resolve(this.remote);
          }
        }
      } catch (err) {
        return this.reject(err);
      }
    }
  }
}

module.exports = { Connection };
