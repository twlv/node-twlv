const { Node } = require('../../');
const { MemoryDialer, MemoryListener } = require('../../transports/memory');
const { MemoryFinder } = require('../../finders/memory');
const assert = require('assert');

describe('Case: relay', () => {
  before(() => process.on('unhandledRejection', err => console.error('Unhandled', err)));
  after(() => process.removeAllListeners('unhandledRejection'));

  it('send to using relay', async () => {
    let gw1 = new Node();
    let gw2 = new Node();
    let node1 = new Node();
    let node2 = new Node();

    gw1.addListener(new MemoryListener());
    gw2.addListener(new MemoryListener());

    gw1.addDialer(new MemoryDialer());
    gw2.addDialer(new MemoryDialer());
    node1.addDialer(new MemoryDialer());
    node2.addDialer(new MemoryDialer());

    node1.addFinder(new MemoryFinder());
    node2.addFinder(new MemoryFinder());

    try {
      await gw1.start();
      await gw2.start();
      await node1.start();
      await node2.start();

      await gw1.connect(`memory:${gw2.identity.address}`);
      await node1.connect(`memory:${gw1.identity.address}`);
      await node2.connect(`memory:${gw1.identity.address}`);
      await node1.connect(`memory:${gw2.identity.address}`);
      await node2.connect(`memory:${gw2.identity.address}`);

      await new Promise(async (resolve, reject) => {
        try {
          node2.on('message', message => {
            if (message.command !== 'foo:bar') {
              return;
            }

            try {
              assert.strictEqual(message.payload.toString(), 'baz');
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
      await gw1.stop();
      await gw2.stop();
      await node1.stop();
      await node2.stop();
    }
  });
});
