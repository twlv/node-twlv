const lpstream = require('length-prefixed-stream');
const { Identity } = require('./identity');
const { Readable } = require('stream');
const { encode, decode, MODE_ENCRYPTED, MODE_SIGNED } = require('./codec');

class Connection extends Readable {
  constructor ({ identity, socket }) {
    super({ objectMode: true });

    this.identity = identity;
    this.socket = socket;

    this.encoder = lpstream.encode();
    this.decoder = lpstream.decode();

    this.encoder.pipe(socket).pipe(this.decoder);

    socket.on('end', this._onSocketEnd.bind(this));
  }

  handshake (nodeAdv) {
    return new Promise((resolve, reject) => {
      this.decoder.on('readable', () => {
        try {
          let frame = this.decoder.read();
          if (!frame) {
            return;
          }

          let message = decode(frame);

          let { command, sig, payload } = message;
          if (command === 'handshake') {
            let advertisement = JSON.parse(payload);
            let identity = new Identity(advertisement.pubKey);
            if (identity.address !== advertisement.address) {
              throw new Error('Handshake failed');
            }
            this.peerIdentity = identity;
            this.write({
              command: 'handshake-ack',
              payload: JSON.stringify({
                nonce: advertisement.nonce,
              }),
            });
          } else if (command === 'handshake-ack') {
            if (!this.peerIdentity.verify(payload, sig)) {
              throw new Error('Handshake signature unverified');
            }

            let advertisement = JSON.parse(this.identity.decrypt(payload));
            if (advertisement.nonce !== nonce) {
              throw new Error('Invalid nonce');
            }

            this.decoder.removeAllListeners('readable');
            this.decoder.on('readable', () => {
              let frame = this.decoder.read();
              if (!frame) {
                return;
              }

              let message = decode(frame);

              if (message.mode & MODE_SIGNED) {
                if (!this.peerIdentity || !this.peerIdentity.verify(message.payload, message.sig)) {
                  return console.warn('Inbound message error, Failed to verify message');
                }
              }

              if (message.mode & MODE_ENCRYPTED) {
                if (!this.identity) {
                  return console.warn('Inbound message error, Failed to decrypt message');
                }

                message.originalPayload = message.payload;
                message.payload = this.identity.decrypt(message.payload);
              }

              this.push(message);
            });

            resolve();
          }
        } catch (err) {
          return reject(err);
        }
      });

      let { address, pubKey, urls, timestamp } = nodeAdv;
      let nonce = Math.floor(Math.random() * 65536).toString(16);
      let advertisement = { address, pubKey, urls, timestamp, nonce };

      this.write({
        command: 'handshake',
        payload: JSON.stringify(advertisement),
        mode: MODE_SIGNED,
      });
    });
  }

  write ({ mode = MODE_SIGNED | MODE_ENCRYPTED, command, payload }) {
    let source = this.identity.address;
    let destination = this.peerIdentity ? this.peerIdentity.address : undefined;

    payload = payload ? Buffer.from(payload) : Buffer.alloc(0);

    if (mode & MODE_ENCRYPTED) {
      if (!this.peerIdentity) {
        throw new Error('Failed encrypt message to unknown peer');
      }

      if (payload.length === 0) {
        throw new Error('Failed encrypt empty payload');
      }

      payload = this.peerIdentity.encrypt(payload);
    }

    let sig = Buffer.alloc(0);
    if (mode & MODE_SIGNED) {
      if (!this.identity) {
        throw new Error('Failed sign message from unknown identity');
      }
      sig = this.identity.sign(payload);
    }

    this.encoder.write(encode({ mode, source, destination, command, sig, payload }));
  }

  end () {
    if (!this.socket) {
      return;
    }

    this.socket.end();
    this.encoder.end();
    this.decoder.end();
  }

  _onSocketEnd () {
    // this.peer = undefined;
    this.destroy();
  }

  _read () {
    // noop
  }
}

module.exports = { Connection };
