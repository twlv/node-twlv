const assert = require('assert');
const { MemoryDialer, MemoryReceiver } = require('../../transports/memory');

describe('Transport: Memory', () => {
  beforeEach(() => {
    MemoryReceiver.reset();
  });

  it('caught error on dialing unknown url', async () => {
    let dialer = new MemoryDialer();

    try {
      await dialer.dial('memory:bar');
      throw new Error('Oops');
    } catch (err) {
      if (err.message === 'Oops') {
        throw err;
      }
    }
  });

  it('listening and dialing', async () => {
    let receiver = new MemoryReceiver();
    let dialer = new MemoryDialer();

    let receiverSocket;
    receiver.on('socket', socket => {
      receiverSocket = socket;
    });

    try {
      await receiver.up({ identity: { address: '1' } });

      let dialerSocket = await dialer.dial('memory:1');

      let receiverData;
      let receiverDataReady = new Promise(resolve => {
        receiverSocket.on('data', data => {
          receiverData = data.toString();
          resolve();
        });
      });

      let dialerData;
      let dialerDataReady = new Promise(resolve => {
        dialerSocket.on('data', data => {
          dialerData = data.toString();
          resolve();
        });
      });

      dialerSocket.write('foo');
      receiverSocket.write('bar');

      await Promise.all([ receiverDataReady, dialerDataReady ]);

      assert.strictEqual(receiverData, 'foo');
      assert.strictEqual(dialerData, 'bar');
    } finally {
      await receiver.down();
    }
  });
});
