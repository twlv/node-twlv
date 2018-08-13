const { Identity } = require('./identity');
const assert = require('assert');

class Peer extends Identity {
  constructor ({ networkId, address, pubKey, urls, timestamp }) {
    super(pubKey);

    assert.strictEqual(address, this.address, 'Mismatch address');

    this.networkId = networkId;
    this.urls = urls;
    this.timestamp = new Date(timestamp);
  }

  getEligibleUrls (node) {
    return this.urls.filter(url => node.dialers.find(dialer => url.startsWith(`${dialer.proto}:`)));
  }

  update (peerInfo) {
    this.urls = peerInfo.urls;
    this.timestamp = new Date(peerInfo.timestamp);
  }
}

module.exports = { Peer };
