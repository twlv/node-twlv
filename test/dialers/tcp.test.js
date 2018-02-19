const assert = require('assert');
const TcpDialer = require('../../dialers/tcp');
const TcpListener = require('../../listeners/tcp');

describe('Tcp', () => {
  it('case: dialing and listening', async () => {
    let listener = new TcpListener();
    let dialer = new TcpDialer();

    let listenerSocket;
    let listenerSocketReady = new Promise(resolve => {
      listener.on('socket', socket => {
        listenerSocket = socket;
        resolve();
      });
    });

    try {
      await listener.up();

      let dialerSocket = await dialer.dial(`tcp://127.0.0.1:${listener.port}`);

      await listenerSocketReady;

      assert(dialerSocket);
      assert(listenerSocket);

      let listenerData;
      let dialerData;
      let listenerDataReady = new Promise(resolve => {
        listenerSocket.on('data', data => {
          listenerData = data.toString();
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
      listenerSocket.write('bar');

      await Promise.all([listenerDataReady, dialerDataReady]);

      assert.equal(listenerData, 'foo');
      assert.equal(dialerData, 'bar');
    } finally {
      await listener.down();
    }
  });

  describe('#getUrls()', () => {
    it('return urls', async () => {
      let listener = new TcpListener();
      await listener.up();

      listener.urls.forEach(url => assert(url.startsWith('tcp:')));

      await listener.down();
    });
  });
});
