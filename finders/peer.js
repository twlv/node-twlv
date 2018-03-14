class PeerFinder {
  constructor () {
    this.name = 'peer';

    this._onNodeMessage = this._onNodeMessage.bind(this);
  }

  find (address) {
    return new Promise(resolve => {
      this.works.push({ address, resolve });
      this.node.broadcast({ command: 'peerfinder.req', payload: address });
    });
  }

  async _onNodeMessage (message) {
    if (!this.node || !message.command.startsWith('peerfinder.')) {
      return;
    }

    try {
      if (message.command === 'peerfinder.req') {
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
      } else if (message.command === 'peerfinder.res') {
        let peerInfo = JSON.parse(message.payload);
        this.works = this.works.filter(work => {
          if (work.address !== peerInfo.address) {
            return;
          }
          work.resolve(peerInfo);
        });
      }
    } catch (err) {
      console.warn('PeerFinder caught error', err);
    }
  }

  up (node) {
    this.works = [];

    this.node = node;
    this.node.on('message', this._onNodeMessage);
  }

  down () {
    this.works.forEach(work => work.resolve());
    this.works = [];

    this.node.removeListener('message', this._onNodeMessage);
    this.node = undefined;
  }
}

module.exports = { PeerFinder };
