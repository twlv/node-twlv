const nodes = [];

class MemoryFinder {
  static reset () {
    nodes.splice(0);
  }

  constructor () {
    this.name = 'memory';
  }

  find (address) {
    let node = nodes.find(node => node.identity.address === address);
    if (!node) {
      return;
    }

    return node.advertisement;
  }

  up (node) {
    this.node = node;
    nodes.push(this.node);
  }

  down () {
    let index = nodes.indexOf(this.node);
    if (index !== -1) {
      nodes.splice(index, 1);
    }
    this.node = undefined;
  }
}

module.exports = { MemoryFinder };
