import { EventEmitter } from 'node:events';

// Single process-wide bus: routes call emitUpdate() after a successful write,
// the SSE endpoint in server.js relays it to every connected browser tab.
export const bus = new EventEmitter();
bus.setMaxListeners(0);

export function emitUpdate(type) {
  bus.emit('update', type);
}
