const assert = require('assert');
const { TcpDialer, TcpReceiver } = require('../../transports/tcp');

describe('Transport: Tcp', () => {
  it('dialing and listening', async () => {
    let receiver = new TcpReceiver();
    let dialer = new TcpDialer();

    let receiverSocket;
    let receiverSocketReady = new Promise(resolve => {
      receiver.on('socket', socket => {
        receiverSocket = socket;
        resolve();
      });
    });

    try {
      await receiver.up();

      let dialerSocket = await dialer.dial(`tcp://127.0.0.1:${receiver.port}`);

      await receiverSocketReady;

      assert(dialerSocket);
      assert(receiverSocket);

      let receiverData;
      let dialerData;
      let receiverDataReady = new Promise(resolve => {
        receiverSocket.on('data', data => {
          receiverData = data.toString();
          resolve();
        });
      });

      let dialerDataReady = new Promise(resolve => {
        dialerSocket.on('data', data => {
          dialerData = data.toString();
          resolve();
        });
      });

      dialerSocket.write('foo');
      receiverSocket.write('bar');

      await Promise.all([receiverDataReady, dialerDataReady]);

      assert.strictEqual(receiverData, 'foo');
      assert.strictEqual(dialerData, 'bar');
    } finally {
      await receiver.down();
    }
  });

  describe('#getUrls()', () => {
    it('return urls', async () => {
      let receiver = new TcpReceiver();
      await receiver.up();

      receiver.urls.forEach(url => assert(url.startsWith('tcp:')));

      await receiver.down();
    });
  });
});
