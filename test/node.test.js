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
      assert.equal(node.identity, identity);
    });
  });

  describe('#addListener()', () => {
    it('add new listener', () => {
      let listenerMock = {
        listen () {},
        on () {}
      };
      let node = new Node();
      node.addListener(listenerMock);
      assert.equal(node.listeners[0], listenerMock);
    });
  });

  describe('#addDialer()', () => {
    it('add new dialer', () => {
      let dialerMock = {};
      let node = new Node();
      node.addDialer(dialerMock);
      assert.equal(node.dialers[0], dialerMock);
    });
  });

  describe('#dial()', () => {
    it('invoke suitable dialer', async () => {
      let fooDialer = {
        name: 'foo',

        dial (url) {
          this.dialedUrl = url;
          return {};
        },
      };
      let barDialer = {
        name: 'bar',

        dial (url) {
          this.dialedUrl = url;
          return {};
        },
      };
      let node = new Node();
      node.addDialer(fooDialer);
      node.addDialer(barDialer);

      await node.dial(`foo:1`);
      await node.dial(`bar:2`);

      assert.equal(fooDialer.dialedUrl, 'foo:1');
      assert.equal(barDialer.dialedUrl, 'bar:2');
    });
  });
});
