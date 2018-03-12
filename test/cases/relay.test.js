const { Node } = require('../../');
const { MemoryDialer, MemoryListener } = require('../../transports/memory');
const { MemoryFinder } = require('../../finders/memory');
const assert = require('assert');

describe('Case: relay', () => {
  before(() => process.on('unhandledRejection', err => console.error('Unhandled', err)));
  after(() => process.removeAllListeners('unhandledRejection'));

  it('send to using relay', async () => {
    let gw = new Node();
    let node1 = new Node();
    let node2 = new Node();

    gw.addListener(new MemoryListener());
    node1.addDialer(new MemoryDialer());
    node2.addDialer(new MemoryDialer());

    node1.addFinder(new MemoryFinder());
    node2.addFinder(new MemoryFinder());

    try {
      await gw.start();
      await node1.start();
      await node2.start();

      await node1.connect(`memory:${gw.identity.address}`);
      await node2.connect(`memory:${gw.identity.address}`);

      await new Promise(async (resolve, reject) => {
        try {
          node2.on('message', message => {
            if (message.command !== 'foo:bar') {
              return;
            }

            try {
              assert.equal(message.payload.toString(), 'baz');
              resolve(message);
            } catch (err) {
              reject(err);
            }
          });

          await node1.relay({
            to: node2.identity.address,
            command: 'foo:bar',
            payload: 'baz',
          });
        } catch (err) {
          reject(err);
        }
      });
    } finally {
      await gw.stop();
      await node1.stop();
      await node2.stop();
    }
  });
});
