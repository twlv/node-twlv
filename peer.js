class Peer {
  constructor ({ address, pubKey, urls, timestamp }) {
    this.address = address;
    this.pubKey = pubKey;
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
