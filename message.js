const MODE_PLAIN = 0;
const MODE_ENCRYPTED = 1;
const MODE_SIGNED = 2;

class Message {
  static from (message) {
    return message instanceof Message ? message : new Message(message);
  }

  static fromBuffer (buf) {
    let offset = 0;
    let mode = buf.readInt8(offset++);
    let ttl = buf.readUInt8(offset++);

    let from = buf.toString('hex', offset, offset + 10);
    offset += 10;
    let to = buf.toString('hex', offset, offset + 10);
    offset += 10;

    let signature = buf.slice(offset, offset + 64);
    offset += 64;

    let command = readLengthPrefixed(buf, offset);
    command = command.toString('utf8');
    offset += command.length + 1;

    let payload = buf.slice(offset);

    let message = new Message({
      mode,
      ttl,
      from,
      to,
      command,
      signature,
    });

    if (message.hasEncryptFlag()) {
      message.encrypted = payload;
    } else {
      message.payload = payload;
    }

    return message;
  }

  constructor ({
    mode = MODE_ENCRYPTED | MODE_SIGNED,
    from = '',
    to = '',
    command = '',
    payload = Buffer.alloc(0),
    ttl = 1,
    signature = Buffer.alloc(0),
    encrypted = Buffer.alloc(0),
  } = {}) {
    this.mode = mode;
    this.from = from;
    this.to = to;
    this.ttl = ttl;
    this.command = command;
    this.payload = toBuffer(payload);
    this.signature = toBuffer(signature);
    this.encrypted = toBuffer(encrypted);
  }

  hasEncryptFlag () {
    return Boolean(this.mode & MODE_ENCRYPTED);
  }

  hasSignFlag () {
    return Boolean(this.mode & MODE_SIGNED);
  }

  sign (identity) {
    if (!this.hasSignFlag()) {
      return;
    }

    if (!identity || identity.address !== this.from) {
      throw new Error('Invalid identity to sign with');
    }

    let payload = this.hasEncryptFlag() ? this.encrypted : this.payload;
    this.signature = identity.sign(payload);

    return this;
  }

  verify (identity) {
    if (!this.hasSignFlag()) {
      return;
    }

    if (!identity || identity.address !== this.from) {
      throw new Error('Invalid identity to verify with');
    }

    let payload = this.hasEncryptFlag() ? this.encrypted : this.payload;
    if (!identity.verify(payload, this.signature)) {
      throw new Error('Invalid signature');
    }

    return this;
  }

  encrypt (identity) {
    if (!this.hasEncryptFlag()) {
      return;
    }

    if (!identity || identity.address !== this.to) {
      throw new Error('Invalid identity to encrypt with');
    }

    this.encrypted = identity.encrypt(this.payload);

    return this;
  }

  decrypt (identity) {
    if (!this.hasEncryptFlag()) {
      return;
    }

    if (!identity || identity.address !== this.to) {
      throw new Error('Invalid identity to decrypt with');
    }

    this.payload = identity.decrypt(this.encrypted);

    return this;
  }

  getBuffer () {
    if (!this.from) {
      throw new Error('Message from value is required');
    }

    if (this.hasSignFlag() && this.signature.length === 0) {
      throw new Error('Invalid signature');
    }

    if (this.hasEncryptFlag() && this.encrypted.length === 0) {
      throw new Error('Invalid encrypted');
    }

    let payload = this.hasEncryptFlag() ? this.encrypted : this.payload;
    let commandBuf = getLengthPrefixed(this.command);
    let buf = Buffer.alloc(86 + commandBuf.length + payload.length);
    let offset = 0;
    buf.writeUInt8(this.mode, offset++);
    buf.writeUInt8(this.ttl, offset++);
    buf.write(this.from, offset, 10, 'hex');
    offset += 10;
    if (this.to) {
      buf.write(this.to, offset, 10, 'hex');
    }
    offset += 10;

    this.signature.copy(buf, offset);
    offset += 64;

    commandBuf.copy(buf, offset);
    offset += commandBuf.length;

    payload.copy(buf, offset);

    return buf;
  }

  clone () {
    return new Message(this);
  }
}

function toBuffer (payload = Buffer.alloc(0)) {
  if (typeof payload === 'string') {
    return Buffer.from(payload);
  }

  if (payload instanceof Buffer) {
    return payload;
  }

  return Buffer.from(JSON.stringify(payload));
}

function getLengthPrefixed (payload) {
  payload = toBuffer(payload);
  let buf = Buffer.alloc(1 + payload.length);
  buf.writeUInt8(payload.length);
  payload.copy(buf, 1);
  return buf;
}

function readLengthPrefixed (buf, offset) {
  let length = buf.readUInt8(offset);
  let result = buf.slice(offset + 1, offset + length + 1);
  return result;
}

module.exports = { Message, MODE_PLAIN, MODE_SIGNED, MODE_ENCRYPTED };
