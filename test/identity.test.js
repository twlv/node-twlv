const { Identity } = require('../identity');
const assert = require('assert');

const PRIV_KEY = `-----BEGIN RSA PRIVATE KEY-----
MIIBPAIBAAJBAJrNy2CzZJX3hiRjmMYitAqMBG43JmZkXyRTx8vZkrIzjFJpDGjr
LtoBWMbJj4LmNsooLZoMLxuYspn62XB/skECAwEAAQJAbQusSNj1cOJknrt9wYxu
kMNi15SHuzbXAkr2AbWorVej+VpKTiy8o9VMLhpdDIZsd2s0jOXOQWtuUfhCSuRR
5QIhAMenfK6JjxaXcyHucARjIpg6h+z4bNbnwXMQ2Zs2YUKzAiEAxn37hiJw+sAJ
F9KExLfs3wEQIS18FLnIzGsCjcSy4TsCIQCwPH3oq3BtJr7wgsLKfJ+69F+rpBaf
FPBEG+maAsST1QIhAJ1MeWdzI9WTGaGnU1AR8cVIMmAYi5xhHp/grcVre9bBAiEA
g8opwJ0qWfoS594xaHkZr7tJgUS8w3MJKHJVX2YLNNk=
-----END RSA PRIVATE KEY-----`;

const PUB_KEY = `-----BEGIN PUBLIC KEY-----
MFwwDQYJKoZIhvcNAQEBBQADSwAwSAJBAJrNy2CzZJX3hiRjmMYitAqMBG43JmZk
XyRTx8vZkrIzjFJpDGjrLtoBWMbJj4LmNsooLZoMLxuYspn62XB/skECAwEAAQ==
-----END PUBLIC KEY-----`;

const ADDRESS = '6954b4e0290ca6009c28';

describe('Identity', () => {
  describe('.generate()', () => {
    it('generate new identity', () => {
      let identity = Identity.generate();
      assert(identity instanceof Identity);
    });
  });

  describe('constructor', () => {
    it('create new identity by its private key', () => {
      let identity = new Identity(PRIV_KEY);

      assert.equal(identity.address, ADDRESS);
      assert.equal(identity.privKey, PRIV_KEY);
      assert.equal(identity.pubKey, PUB_KEY);
      assert(identity.isPrivate());
    });

    it('create new identity by its public key', () => {
      let identity = new Identity(PUB_KEY);

      assert.equal(identity.address, ADDRESS);
      assert.equal(identity.pubKey, PUB_KEY);
      assert(!identity.isPrivate());
      assert(!identity.privKey);
    });
  });
});
