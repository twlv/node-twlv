const finders = [];

class MemoryFinder {
  static reset () {
    finders.splice(0);
  }

  constructor (node) {
    this.name = 'memory';
    this.node = node;

    finders.push(this);
  }

  find (address) {
    let finder = finders.find(finder => finder.node.identity.address === address);
    if (!finder) {
      return;
    }

    return finder.node.advertisement;
  }

  up () {
    // noop
  }

  down () {
    // noop
  }
}

module.exports = MemoryFinder;
