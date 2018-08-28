const debug = require('debug')('twlv:core:registry');
const { Peer } = require('./peer');

const TIMEOUT_FIND = 3000;

class Registry {
  constructor (node) {
    this.node = node;
    this.finders = [];
    this.peers = [];
    this.tasks = [];
  }

  get networkId () {
    return this.node.networkId;
  }

  get running () {
    return this.node.running;
  }

  async addFinder (finder) {
    this.finders.push(finder);
    if (this.running) {
      await finder.up(this.node);
    }
  }

  async removeFinder (finder) {
    if (this.running) {
      await finder.down();
    }
    let index = this.finders.indexOf(finder);
    if (index !== -1) {
      this.finders.splice(index, 1);
    }
  }

  up () {
    this.tasks = [];
    return Promise.all(this.finders.map(finder => finder.up(this.node)));
  }

  down () {
    this.tasks.forEach(task => task.reject(new Error('Registry down')));
    this.tasks = [];
    return Promise.all(this.finders.map(finder => finder.down()));
  }

  async find (address, { timeout = TIMEOUT_FIND, cache = true } = {}) {
    if (cache) {
      let peer = await this.get(address);
      if (peer) {
        return peer;
      }
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

      let _t = setTimeout(() => _reject(new Error(`Find timeout, address: ${address}`)), timeout);

      // TODO: potentially leaked promise still running while node stopped
      await Promise.all(this.finders.map(async finder => {
        try {
          let peerInfo = await finder.find(address);
          if (!peerInfo) {
            return;
          }

          if (peerInfo.networkId !== this.networkId) {
            return;
          }

          clearTimeout(_t);
          _resolve(peerInfo);
        } catch (err) {
          debug(`Finder caught: ${err.stack}`);
        }
      }));

      clearTimeout(_t);
      _reject(new Error(`Peer not found, address: ${address}`));
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

  invalidate (peer) {
    let index = this.peers.findIndex(p => p.address === peer.address);
    if (index !== -1) {
      this.peers.splice(index, 1);
    }
  }
}

module.exports = { Registry };
