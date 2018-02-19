const MODE_PLAIN = 0;
const MODE_ENCRYPTED = 1;
const MODE_SIGNED = 2;

function encode ({ mode, source, destination, command, sig, payload }) {
  let buf = Buffer.alloc(22 + command.length);
  buf.writeInt8(mode, 0);
  buf.write(source, 1, 'hex');
  if (destination) {
    buf.write(destination, 11, 'hex');
  }
  buf.writeInt8(command.length, 21);
  buf.write(command, 22);

  return Buffer.concat([ buf, Buffer.from([sig.length]), sig, payload ]);
}

function decode (frame) {
  let mode = frame.readInt8(0);
  let source = frame.toString('hex', 1, 10);
  let destination = frame.toString('hex', 11, 20);
  let cmdLen = frame.readInt8(21);
  let command = frame.toString('utf8', 22, 22 + cmdLen);
  let sigLen = frame.readInt8(22 + cmdLen);
  let sig = frame.slice(23 + cmdLen, 23 + cmdLen + sigLen);
  let payload = frame.slice(23 + cmdLen + sigLen);

  return { mode, source, destination, command, sig, payload };
}

module.exports = { encode, decode, MODE_PLAIN, MODE_SIGNED, MODE_ENCRYPTED };
