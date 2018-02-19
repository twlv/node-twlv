# twlv

## Listener

- Listener of incoming connection from other peer
- Listener must have method up and down
- Listener must an EventEmitter
- Listener must emit socket event on socket inbound

## Dialer

- Dialer to connect to other peer
- Dialer must have dial method
- Method dial throw error when no connection established

## Finder

- Finder to find other peer
- Finder must have method up and down
- Finder must have find method
- Method find return undefined when no peer found
- Method find must not throw error
