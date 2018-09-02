const assert = require('assert');
const { Node } = require('../../node');
const { MemoryReceiver, MemoryDialer } = require('../../transports/memory');
const { PeerFinder } = require('../../finders/peer');

describe('PeerFinder', () => {
  before(() => process.on('unhandledRejection', err => console.error('Unhandled', err)));
  after(() => process.removeAllListeners('unhandledRejection'));

  it('get peer info from connected peer', async () => {
    let node1 = new Node();
    let node2 = new Node();
    let node3 = new Node();

    node1.addReceiver(new MemoryReceiver());
    node2.addDialer(new MemoryDialer());
    node3.addDialer(new MemoryDialer());

    node1.addFinder(new PeerFinder());
    node2.addFinder(new PeerFinder());
    node3.addFinder(new PeerFinder());

    try {
      await node1.start();
      await node2.start();
      await node3.start();

      await node2.connect(`memory:${node1.identity.address}`);
      await node3.connect(`memory:${node1.identity.address}`);

      let peer = await node2.find(node3.identity.address);

      assert(peer);
      assert.strictEqual(peer.address, node3.identity.address);
      assert.strictEqual(peer.pubKey, node3.identity.pubKey);
    } finally {
      try { await node1.stop(); } catch (err) { /* noop */ }
      try { await node2.stop(); } catch (err) { /* noop */ }
      try { await node3.stop(); } catch (err) { /* noop */ }
    }
  });
});
