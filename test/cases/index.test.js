const assert = require('assert');
const { Node } = require('../..');
const { MemoryListener, MemoryDialer } = require('../../transports/memory');
const { MemoryFinder } = require('../../finders/memory');

describe('cases', () => {
  before(() => process.on('unhandledRejection', err => console.error('Unhandled', err)));
  after(() => process.removeAllListeners('unhandledRejection'));

  beforeEach(() => {
    MemoryListener.reset();
    MemoryFinder.reset();
  });

  describe('find others', () => {
    it('find other node by its address', async () => {
      let node1 = new Node();
      let node2 = new Node();

      try {
        node1.addListener(new MemoryListener());
        node1.addFinder(new MemoryFinder());

        node2.addListener(new MemoryListener());
        node2.addFinder(new MemoryFinder());

        await node1.start();
        await node2.start();

        let peer = await node1.find(node2.identity.address);

        assert.strictEqual(peer.address, node2.identity.address);
        assert.strictEqual(peer.pubKey, node2.identity.pubKey);
        assert.strictEqual(peer.urls[0], `memory:${node2.identity.address}`);
      } finally {
        await node1.stop();
        await node2.stop();
      }
    });

    it('throw error when no peer with address', async () => {
      let node1 = new Node();
      node1.addFinder(new MemoryFinder());

      try {
        await node1.start();
        await node1.find('foo');
        throw new Error('Oops');
      } catch (err) {
        if (err.message !== 'Peer not found') {
          throw err;
        }
      } finally {
        await node1.stop();
      }
    });

    it('throw error when got timeout', async () => {
      let node1 = new Node();
      node1.addFinder({
        find (address) {
          return new Promise(resolve => {});
        },
        up () {},
        down () {},
      });

      node1.addFinder({
        find (address) {
          return new Promise(resolve => {});
        },
        up () {},
        down () {},
      });

      try {
        await node1.start();

        await node1.find('foo', { timeout: 100 });
        throw new Error('Oops');
      } catch (err) {
        if (err.message !== 'Find timeout') {
          throw err;
        }
      } finally {
        await node1.stop();
      }
    });
  });

  describe('connect two nodes', () => {
    it('connect nodes by its url', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener());
      node1.addDialer(new MemoryDialer());

      node2.addListener(new MemoryListener());
      node2.addDialer(new MemoryDialer());

      try {
        await node1.start();
        await node2.start();

        let connection = await node1.connect(`memory:${node2.identity.address}`);

        assert(connection);
        assert.strictEqual(connection, node1.connections[0]);
        assert.strictEqual(node1.connections[0].peer.address, node2.identity.address);
        assert.strictEqual(node2.connections[0].peer.address, node1.identity.address);
      } finally {
        await node1.stop();
        await node2.stop();
      }
    });

    it('connect nodes by its address', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener());
      node1.addDialer(new MemoryDialer());
      node1.addFinder(new MemoryFinder());

      node2.addListener(new MemoryListener());
      node2.addDialer(new MemoryDialer());
      node2.addFinder(new MemoryFinder());

      try {
        await node1.start();
        await node2.start();

        let connection = await node1.connect(node2.identity.address);

        assert(connection);
        assert.strictEqual(connection, node1.connections[0]);
        assert.strictEqual(node1.connections[0].peer.address, node2.identity.address);
        assert.strictEqual(node2.connections[0].peer.address, node1.identity.address);
      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });

  describe('send to peers', () => {
    it('throw error when sending to itself', async () => {
      let node = new Node();

      await node.start();

      try {
        await node.send({
          to: node.identity.address,
          command: 'foo',
          payload: 'bar',
        });

        throw new Error('Oops');
      } catch (err) {
        if (err.message !== 'Invalid to value') {
          throw err;
        }
      }
    });

    it('send to peer by its address', async () => {
      let node1 = new Node();
      let node2 = new Node();

      node1.addListener(new MemoryListener());
      node1.addDialer(new MemoryDialer());
      node1.addFinder(new MemoryFinder());

      node2.addListener(new MemoryListener());
      node2.addDialer(new MemoryDialer());
      node2.addFinder(new MemoryFinder());

      await node1.start();
      await node2.start();

      await new Promise(async (resolve, reject) => {
        try {
          node2.on('message', message => {
            try {
              assert.strictEqual(message.from, node1.identity.address);
              assert.strictEqual(message.to, node2.identity.address);
              assert.strictEqual(message.command, 'foo');
              assert.strictEqual(message.payload.toString(), 'bar');
              resolve();
            } catch (err) {
              reject(err);
            }
          });

          await node1.send({
            to: node2.identity.address,
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

      node1.addListener(new MemoryListener());
      node1.addDialer(new MemoryDialer());
      node1.addFinder(new MemoryFinder());

      node2.addListener(new MemoryListener());
      node2.addDialer(new MemoryDialer());
      node2.addFinder(new MemoryFinder());

      await node1.start();
      await node2.start();

      await node1.connect(node2.identity.address);

      await new Promise(async (resolve, reject) => {
        try {
          node2.on('message', message => {
            try {
              assert.strictEqual(message.from, node1.identity.address);
              assert.strictEqual(message.to, node2.identity.address);
              assert.strictEqual(message.command, 'foo');
              assert.strictEqual(message.payload.toString(), 'bar');
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
    it('reuse connection', async () => {
      let node1 = new Node();
      let node2 = new Node();

      try {
        node1.addListener(new MemoryListener());
        node1.addDialer(new MemoryDialer());

        node2.addListener(new MemoryListener());
        node2.addDialer(new MemoryDialer());

        await node1.start();
        await node2.start();

        await node1.connect(`memory:${node2.identity.address}`);

        assert.strictEqual(node1.connections.length, 1);
        assert.strictEqual(node2.connections.length, 1);

        let oldConnection = node1.connections[0];
        let connection = await node1.connect(`memory:${node2.identity.address}`);
        assert.strictEqual(node1.connections.length, 1);
        assert.strictEqual(node2.connections.length, 1);
        assert.strictEqual(connection, oldConnection);

        oldConnection = node2.connections[0];
        connection = await node2.connect(`memory:${node1.identity.address}`);
        assert.strictEqual(node1.connections.length, 1);
        assert.strictEqual(node2.connections.length, 1);
        // assert.strictEqual(connection, oldConnection);
      } finally {
        await node1.stop();
        await node2.stop();
      }
    });
  });
});
