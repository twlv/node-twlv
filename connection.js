const lpstream = require('length-prefixed-stream');
const { Identity } = require('./identity');
const { Readable } = require('stream');
const { encode, decode, MODE_PLAIN, MODE_ENCRYPTED, MODE_SIGNED } = require('./codec');

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
      let resultAdv;

      let _onHandshakingReadable = () => {
        let frame;
        while ((frame = this.decoder.read())) {
          try {
            let message = decode(frame);

            let { command, sig, payload } = message;
            if (command === 'handshake') {
              resultAdv = JSON.parse(payload);
              let { address, pubKey, nonce } = resultAdv;
              let identity = new Identity(pubKey);
              if (identity.address !== address) {
                throw new Error('Handshake failed');
              }
              this.peerIdentity = identity;
              this.write({
                command: 'handshake-ack',
                payload: JSON.stringify({ nonce }),
              });
            } else if (command === 'handshake-ack') {
              if (!this.peerIdentity.verify(payload, sig)) {
                throw new Error('Handshake signature unverified');
              }

              let ack = JSON.parse(this.identity.decrypt(payload));
              if (ack.nonce !== nonce) {
                throw new Error('Invalid nonce');
              }

              this.decoder.removeListener('readable', _onHandshakingReadable);
              this.decoder.on('readable', () => {
                let frame;
                while ((frame = this.decoder.read())) {
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
                }
              });

              resolve(resultAdv);
            }
          } catch (err) {
            return reject(err);
          }
        }
      };

      this.decoder.on('readable', _onHandshakingReadable);

      let { address, pubKey, urls, timestamp } = nodeAdv;
      let nonce = Math.floor(Math.random() * 65536).toString(16);
      this.write({
        command: 'handshake',
        payload: JSON.stringify({ address, pubKey, urls, timestamp, nonce }),
        mode: MODE_SIGNED,
      });
    });
  }

  write ({ mode = MODE_SIGNED | MODE_ENCRYPTED, command, payload }) {
    let from = this.identity.address;
    let to = this.peerIdentity ? this.peerIdentity.address : undefined;

    if (!payload) {
      mode = MODE_PLAIN;
      payload = Buffer.alloc(0);
    } else if (payload instanceof Buffer === false) {
      try {
        payload = Buffer.from(payload);
      } catch (err) {
        throw new Error('Payload unserialized');
      }
    }

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

    this.encoder.write(encode({ mode, from, to, command, sig, payload }));
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
