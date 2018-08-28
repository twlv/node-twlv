const assert = require('assert');
const { Message } = require('../message');
const { Identity } = require('../identity');

describe('Message', () => {
  it('construct with data', () => {
    let identity1 = Identity.generate();
    let identity2 = Identity.generate();

    let message = new Message({ from: identity1.address, to: identity2.address, command: 'foo', payload: 'bar' });
    message.encrypt(identity2);
    message.sign(identity1);

    let buf = message.getBuffer();

    let message2 = Message.fromBuffer(buf);

    assert.strictEqual(message2.mode, 3);
    assert.strictEqual(message2.from, identity1.address);
    assert.strictEqual(message2.to, identity2.address);
    message2.decrypt(identity2);
    message2.verify(identity1);

    assert.strictEqual(message2.payload.toString('hex'), message.payload.toString('hex'));
  });
});
