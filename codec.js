const MODE_PLAIN = 0;
const MODE_ENCRYPTED = 1;
const MODE_SIGNED = 2;

function encode ({ mode, from, to, command, sig, payload }) {
  let buf = Buffer.alloc(22 + command.length);
  buf.writeInt8(mode, 0);
  buf.write(from, 1, 'hex');
  if (to) {
    buf.write(to, 11, 'hex');
  }
  buf.writeInt8(command.length, 21);
  buf.write(command, 22);

  return Buffer.concat([ buf, Buffer.from([sig.length]), sig, payload ]);
}

function decode (frame) {
  let mode = frame.readInt8(0);
  let from = frame.toString('hex', 1, 11);
  let to = frame.toString('hex', 11, 21);
  let cmdLen = frame.readInt8(21);
  let cmdUntil = 22 + cmdLen;
  let command = frame.toString('utf8', 22, cmdUntil);
  let sigLen = frame.readInt8(cmdUntil);
  let sigFrom = 23 + cmdLen;
  let sigUntil = sigFrom + sigLen;
  let sig = frame.slice(sigFrom, sigUntil);
  let payload = frame.slice(sigUntil);

  return { mode, from, to, command, sig, payload };
}

module.exports = { encode, decode, MODE_PLAIN, MODE_SIGNED, MODE_ENCRYPTED };
