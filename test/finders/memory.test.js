const { MemoryFinder } = require('../../finders/memory');
const assert = require('assert');

describe('Memory Finder', () => {
  it('find other node', async () => {
    let finder1 = new MemoryFinder();
    let finder2 = new MemoryFinder();

    try {
      await finder1.up({ identity: { address: '1' }, advertisement: { address: '1' } });
      await finder2.up({ identity: { address: '2' }, advertisement: { address: '2' } });

      let node = await finder1.find('2');
      assert.strictEqual(node.address, '2');
    } finally {
      await finder1.down();
      await finder2.down();
    }
  });
});
