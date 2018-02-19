class Peer {
  constructor ({ address, pubKey, urls, timestamp }) {
    this.address = address;
    this.pubKey = pubKey;
    this.urls = urls;
    this.timestamp = timestamp;
  }
}

module.exports = { Peer };
