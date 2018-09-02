const debug = require('debug')('twlv:core:finders:peer');

class PeerFinder {
  constructor () {
    this.name = 'peer';

    this.reqHandler = {
      test: 'peerfinder.req',
      handle: this._onReq.bind(this),
    };

    this.resHandler = {
      test: 'peerfinder.res',
      handle: this._onRes.bind(this),
    };
  }

  find (address) {
    return new Promise(resolve => {
      this.works.push({ address, resolve });
      this.node.broadcast({ command: 'peerfinder.req', payload: address });
    });
  }

  async _onReq (message) {
    try {
      let reqAddr = message.payload.toString();
      let peerInfo = await this.node.registry.get(reqAddr);
      if (!peerInfo) {
        return;
      }

      await this.node.send({
        to: message.from,
        command: 'peerfinder.res',
        payload: JSON.stringify(peerInfo),
      });
    } catch (err) {
      if (debug.enabled) debug(`PeerFinder#_onReq() caught: ${err.stack}`);
    }
  }

  _onRes (message) {
    try {
      let peerInfo = JSON.parse(message.payload);
      this.works = this.works.filter(work => {
        if (work.address !== peerInfo.address) {
          return;
        }
        work.resolve(peerInfo);
      });
    } catch (err) {
      if (debug.enabled) debug(`PeerFinder#_onRes() caught: ${err.stack}`);
    }
  }

  up (node) {
    this.works = [];

    this.node = node;
    this.node.addHandler(this.reqHandler);
    this.node.addHandler(this.resHandler);
  }

  down () {
    this.works.forEach(work => work.resolve());
    this.works = [];

    this.node.removeHandler(this.reqHandler);
    this.node.removeHandler(this.resHandler);
    this.node = undefined;
  }
}

module.exports = { PeerFinder };
