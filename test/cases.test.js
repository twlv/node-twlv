const assert = require('assert');
const { Node } = require('../node');
const { MemoryListener, removeAllListeners } = require('../listeners/memory');
const { MemoryDialer } = require('../dialers/memory');
const { MemoryFinder } = require('../finders/memory');

describe('cases', () => {
  before(() => {
    process.on('unhandledRejection', err => {
      console.error('unhandledRejection', err);
    });
  });

  after(() => {
    process.removeAllListeners('unhandledRejection');
  });

  beforeEach(() => {
    removeAllListeners();
  });

  describe('connect two nodes',  () => {
    it('connect nodes', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener(node1));
      node1.addDialer(new MemoryDialer(node1));

      node2.addListener(new MemoryListener(node2));
      node2.addDialer(new MemoryDialer(node2));

      let connection = await node1.connect(`memory:${node2.identity.address}`);

      assert.equal(connection, node1.connections[0]);
      assert.equal(node1.connections[0].peerIdentity.address, node2.identity.address);
      assert.equal(node2.connections[0].peerIdentity.address, node1.identity.address);
    });
  });

  describe('find other node', () => {
    it('find other node by its address', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener(node1));
      node1.addFinder(new MemoryFinder(node1));

      node2.addListener(new MemoryListener(node2));
      node2.addFinder(new MemoryFinder(node2));

      let peer = await node1.find(node2.identity.address);

      assert.equal(peer.address, node2.identity.address);
      assert.equal(peer.pubKey, node2.identity.pubKey);
      assert.equal(peer.urls[0], `memory:${node2.identity.address}`);
    });
  });
});
