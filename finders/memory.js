const { Peer } = require('../peer');

const finders = [];

class MemoryFinder {
  constructor (node) {
    this.node = node;

    finders.push(this);
  }

  find (address) {
    let finder = finders.find(finder => finder.node.identity.address === address);
    return new Peer(finder.node.advertisement);
  }
}

function removeAllFinders () {
  finders.splice(0);
}

module.exports = { MemoryFinder, removeAllFinders };
