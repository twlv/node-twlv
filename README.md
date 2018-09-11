# twlv

```
      oe      .--~*teu.
    .@88     dF     988Nx
==*88888    d888b   `8888>
   88888    ?8888>  98888F
   88888     "**"  x88888~
   88888          d8888*`
   88888        z8**"`   :
   88888      :?.....  ..F
   88888     <""888888888~
   88888     8:  "888888*
'**%%%%%%**  ""    "**"`    npm i @twlv/core
```

`twlv` is and overlay network library to work with peer to peer networking on top of multiple protocols.

```js
const { Node } = require('@twlv/core');
const { TcpReceiver, TcpDialer } = require('@twlv/core/transports/tcp');
const { MemoryFinder } = require('@twlv/core/finders/memory');

let node1 = new Node();
let node2 = new Node();


(async () => {
  await node1.addReceiver(new TcpReceiver());
  await node1.addDialer(new TcpDialer());
  await node1.addFinder(new MemoryFinder());

  await node2.addReceiver(new TcpReceiver());
  await node2.addDialer(new TcpDialer());
  await node2.addFinder(new MemoryFinder());

  await node1.start();
  await node2.start();

  node1.addHandler({
    test: 'ping',
    handle (message, node) {
      let { from, command } = message;
      let payload = message.payload.toString();
      console.info(`ping> ${from} => ${command} (${payload})`);

      node.send({
        to: from,
        command: 'pong',
        payload,
      });
    },
  });

  node2.addHandler({
    test: 'pong',
    handle (message) {
      let { from, command } = message;
      let payload = message.payload.toString();
      console.info(`pong> ${from} => ${command} (${payload})`);
    },
  });

  node2.send({
    to: node1.identity.address,
    command: 'ping',
    payload: 'foo',
  });

  console.info('Ctrl-C to end this program');
})();
```
