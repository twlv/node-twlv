const assert = require('assert');
const { Identity } = require('../identity');
const { Node } = require('../node');

describe('Node', () => {
  describe('constructor', () => {
    it('create new node with generated identity', () => {
      assert(new Node().identity instanceof Identity);
    });

    it('create new node with supplied identity', () => {
      let identity = Identity.generate();
      let node = new Node({ identity });
      assert.strictEqual(node.identity, identity);
    });
  });

  describe('#addListener()', () => {
    it('add new listener', () => {
      let listenerMock = {
        listen () {},
        on () {},
      };
      let node = new Node();
      node.addListener(listenerMock);
      assert.strictEqual(node.listeners[0], listenerMock);
    });
  });

  describe('#addDialer()', () => {
    it('add new dialer', () => {
      let dialerMock = {};
      let node = new Node();
      node.addDialer(dialerMock);
      assert.strictEqual(node.dialers[0], dialerMock);
    });
  });

  describe('#dial()', () => {
    it('invoke suitable dialer', async () => {
      let fooDialer = {
        proto: 'foo',

        dial (url) {
          this.dialedUrl = url;
          return {};
        },
      };

      let barDialer = {
        proto: 'bar',

        dial (url) {
          this.dialedUrl = url;
          return {};
        },
      };
      let node = new Node();

      node.addDialer(fooDialer);
      node.addDialer(barDialer);

      try {
        await node.start();

        await node.dial(`foo:1`);
        await node.dial(`bar:2`);

        assert.strictEqual(fooDialer.dialedUrl, 'foo:1');
        assert.strictEqual(barDialer.dialedUrl, 'bar:2');
      } finally {
        await node.stop();
      }
    });
  });

  describe('#advertisement', () => {
    it('return empty advertisement from stopped node', () => {
      let node = new Node();

      assert(!node.advertisement);
    });
    it('has address and pubKey field', async () => {
      let node = new Node();

      try {
        node.addListener({
          on () {},
          get urls () {
            return ['foo:1'];
          },
          up () {},
          down () {},
        });

        node.addListener({
          on () {},
          get urls () {
            return ['bar:1'];
          },
          up () {},
          down () {},
        });

        await node.start();

        let advertisement = node.advertisement;
        assert.strictEqual(advertisement.address, node.identity.address);
        assert.strictEqual(advertisement.pubKey, node.identity.pubKey);
        assert.strictEqual(advertisement.urls[0], 'foo:1');
        assert.strictEqual(advertisement.urls[1], 'bar:1');
      } finally {
        await node.stop();
      }
    });
  });
});
