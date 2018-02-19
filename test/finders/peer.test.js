const assert = require('assert');
const { Node } = require('../../node');
const MemoryListener = require('../../listeners/memory');
const MemoryDialer = require('../../dialers/memory');
const PeerFinder = require('../../finders/peer');

describe('PeerFinder', () => {
  before(() => {
    process.on('unhandledRejection', err => console.error('Unhandled rejection', err));
  });

  after(() => {
    process.removeAllListeners('unhandledRejection');
  });

  it('get peer info from connected peer', async () => {
    let node1 = new Node();
    let node2 = new Node();
    let node3 = new Node();

    node1.addListener(new MemoryListener(node1.identity));
    node2.addDialer(new MemoryDialer());
    node3.addDialer(new MemoryDialer());

    node1.addFinder(new PeerFinder(node1));
    node2.addFinder(new PeerFinder(node2));
    node3.addFinder(new PeerFinder(node3));

    await node1.start();
    await node2.start();
    await node3.start();

    await node2.connect(`memory:${node1.identity.address}`);
    await node3.connect(`memory:${node1.identity.address}`);

    let peer = await node2.find(node3.identity.address);
    assert(peer);
    assert.equal(peer.address, node3.identity.address);
    assert.equal(peer.pubKey, node3.identity.pubKey);
  });
});
