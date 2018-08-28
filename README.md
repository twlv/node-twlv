# twlv

## Receiver

- Receiver of incoming connection from other peer
- Receiver must have method up(node) and down
- Receiver must an EventEmitter
- Receiver must emit socket event on socket inbound

## Dialer

- Dialer to connect to other peer
- Dialer must have method up(node) and down
- Dialer must have dial method
- Method dial throw error when no connection established

## Finder

- Finder to find other peer
- Finder must have method up(node) and down
- Finder must have find method
- Method find return undefined when no peer found
- Method find must not throw error
