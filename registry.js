const { Peer } = require('./peer');

const TIMEOUT_FIND = 3000;

class Registry {
  constructor () {
    this.finders = [];
    this.peers = [];
    this.tasks = [];
  }

  addFinder (finder) {
    this.finders.push(finder);
  }

  up () {
    this.tasks = [];
    return Promise.all(this.finders.map(finder => finder.up()));
  }

  down () {
    this.tasks.forEach(task => task.reject(new Error('Registry down')));
    this.tasks = [];
    return Promise.all(this.finders.map(finder => finder.down()));
  }

  async find (address, { timeout = TIMEOUT_FIND } = {}) {
    let peer = await this.get(address);
    if (peer) {
      return peer;
    }

    let peerInfo = await new Promise(async (resolve, reject) => {
      let task = { resolve, reject };
      this.tasks.push(task);

      let _remove = () => {
        let index = this.tasks.indexOf(task);
        if (index !== -1) {
          this.tasks.splice(index, 1);
        }
      };

      let _reject = err => {
        _remove();
        reject(err);
      };

      let _resolve = val => {
        _remove();
        resolve(val);
      };

      let _t = setTimeout(() => _reject(new Error('Find timeout')), timeout);

      await Promise.all(this.finders.map(async finder => {
        try {
          let peerInfo = await finder.find(address);
          if (!peerInfo) {
            return;
          }

          clearTimeout(_t);
          _resolve(peerInfo);
        } catch (err) {
          console.warn('Finder caught error', err);
        }
      }));

      clearTimeout(_t);
      _reject(new Error('Peer not found'));
    });

    return this.put(peerInfo);
  }

  get (address) {
    return this.peers.find(peer => peer.address === address);
  }

  async put (peerInfo) {
    let cachedPeer = await this.get(peerInfo.address);

    if (cachedPeer) {
      cachedPeer.update(peerInfo);
      return cachedPeer;
    }

    let peer = new Peer(peerInfo);
    this.peers.push(peer);

    return peer;
  }
}

module.exports = { Registry };
