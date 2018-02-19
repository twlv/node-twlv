const assert = require('assert');
const { MemoryListener, removeAllListeners } = require('../../listeners/memory');
const { MemoryDialer } = require('../../dialers/memory');

describe('Memory listener and dialer', () => {
  beforeEach(() => {
    removeAllListeners();
  });

  it('listening and dialing', async () => {
    let listener = new MemoryListener({ address: '1' });
    let dialer = new MemoryDialer({ address: '2' });

    let listenerSocket;
    listener.on('socket', socket => {
      listenerSocket = socket;
    });

    let dialerSocket = await dialer.dial('memory:1');

    let listenerData;
    let dialerData;

    listenerSocket.on('data', data => {
      listenerData = data.toString();
    });

    dialerSocket.on('data', data => {
      dialerData = data.toString();
    });

    dialerSocket.write('foo');
    listenerSocket.write('bar');

    await new Promise(resolve => setTimeout(resolve));

    assert.equal(listenerData, 'foo');
    assert.equal(dialerData, 'bar');
  });
});
