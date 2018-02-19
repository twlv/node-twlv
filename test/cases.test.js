const assert = require('assert');
const { Node } = require('../node');
const MemoryListener = require('../listeners/memory');
const MemoryDialer = require('../dialers/memory');
const MemoryFinder = require('../finders/memory');

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
    MemoryListener.reset();
    MemoryFinder.reset();
  });

  describe('find others', () => {
    it('find other node by its address', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener(node1.identity));
      node1.addFinder(new MemoryFinder(node1));

      node2.addListener(new MemoryListener(node2.identity));
      node2.addFinder(new MemoryFinder(node2));

      let peer = await node1.find(node2.identity.address);

      assert.equal(peer.address, node2.identity.address);
      assert.equal(peer.pubKey, node2.identity.pubKey);
      assert.equal(peer.urls[0], `memory:${node2.identity.address}`);
    });

    it('throw error when no peer with address', async () => {
      let node1 = new Node();
      node1.addFinder(new MemoryFinder(node1));

      try {
        await node1.find('foo');
        throw new Error('Oops');
      } catch (err) {
        if (err.message !== 'Peer not found') {
          throw err;
        }
      }
    });

    it('throw error when got timeout', async () => {
      let node1 = new Node();
      node1.addFinder({
        find (address) {
          return new Promise(resolve => {});
        },
      });

      node1.addFinder({
        find (address) {
          return new Promise(resolve => {});
        },
      });

      try {
        await node1.find('foo', { timeout: 100 });
        throw new Error('Oops');
      } catch (err) {
        if (err.message !== 'Find timeout') {
          throw err;
        }
      }
    });
  });

  describe('connect two nodes', () => {
    it('connect nodes by its url', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener(node1.identity));
      node1.addDialer(new MemoryDialer());

      node2.addListener(new MemoryListener(node2.identity));
      node2.addDialer(new MemoryDialer());

      let connection = await node1.connect(`memory:${node2.identity.address}`);

      assert(connection);
      assert.equal(connection, node1.connections[0]);
      assert.equal(node1.connections[0].peerIdentity.address, node2.identity.address);
      assert.equal(node2.connections[0].peerIdentity.address, node1.identity.address);
    });

    it('connect nodes by its address', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener(node1.identity));
      node1.addDialer(new MemoryDialer());
      node1.addFinder(new MemoryFinder(node1));

      node2.addListener(new MemoryListener(node2.identity));
      node2.addDialer(new MemoryDialer());
      node2.addFinder(new MemoryFinder(node2));

      let connection = await node1.connect(node2.identity.address);

      assert(connection);
      assert.equal(connection, node1.connections[0]);
      assert.equal(node1.connections[0].peerIdentity.address, node2.identity.address);
      assert.equal(node2.connections[0].peerIdentity.address, node1.identity.address);
    });
  });

  describe('send to peers', () => {
    it('throw error when sending to itself', async () => {
      let node = new Node();

      await node.start();

      try {
        await node.send(node.identity.address, {
          command: 'foo',
          payload: 'bar',
        });

        throw new Error('Oops');
      } catch (err) {
        if (err.message !== 'Identity destination') {
          throw err;
        }
      }
    });

    it('send to peer by its address', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener(node1.identity));
      node1.addDialer(new MemoryDialer());
      node1.addFinder(new MemoryFinder(node1));

      node2.addListener(new MemoryListener(node2.identity));
      node2.addDialer(new MemoryDialer());
      node2.addFinder(new MemoryFinder(node2));

      await node1.start();
      await node2.start();

      await new Promise(async (resolve, reject) => {
        try {
          node2.on('message', message => {
            try {
              assert.equal(message.from, node1.identity.address);
              assert.equal(message.to, node2.identity.address);
              assert.equal(message.command, 'foo');
              assert.equal(message.payload.toString(), 'bar');
              resolve();
            } catch (err) {
              reject(err);
            }
          });

          await node1.send(node2.identity.address, {
            command: 'foo',
            payload: 'bar',
          });
        } catch (err) {
          reject(err);
        }
      });
    });

    it('broadcast', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener(node1.identity));
      node1.addDialer(new MemoryDialer());
      node1.addFinder(new MemoryFinder(node1));

      node2.addListener(new MemoryListener(node2.identity));
      node2.addDialer(new MemoryDialer());
      node2.addFinder(new MemoryFinder(node2));

      await node1.start();
      await node2.start();

      await node1.connect(node2.identity.address);

      await new Promise(async (resolve, reject) => {
        try {
          node2.on('message', message => {
            try {
              assert.equal(message.from, node1.identity.address);
              assert.equal(message.to, node2.identity.address);
              assert.equal(message.command, 'foo');
              assert.equal(message.payload.toString(), 'bar');
              resolve();
            } catch (err) {
              reject(err);
            }
          });

          await node1.broadcast({
            command: 'foo',
            payload: 'bar',
          });
        } catch (err) {
          reject(err);
        }
      });
    });
  });

  describe('connect to already connected connection', () => {
    it.only('x', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener(node1.identity));
      node1.addDialer(new MemoryDialer());

      node2.addListener(new MemoryListener(node2.identity));
      node2.addDialer(new MemoryDialer());

      await node1.connect(`memory:${node2.identity.address}`);

      assert.equal(node1.connections.length, 1);
      assert.equal(node2.connections.length, 1);

      let oldConnection = node1.connections[0];
      let connection = await node1.connect(`memory:${node2.identity.address}`);
      assert.equal(node1.connections.length, 1);
      assert.equal(node2.connections.length, 1);
      assert.equal(connection, oldConnection);

      oldConnection = node2.connections[0];
      connection = await node2.connect(`memory:${node1.identity.address}`);
      assert.equal(node1.connections.length, 1);
      assert.equal(node2.connections.length, 1);
      assert.equal(connection, oldConnection);
    });
  });
});
