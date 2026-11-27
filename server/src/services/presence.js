// In-memory presence. Statuses: online | looking | partner_found | connecting | in_call | offline
const sockets = new Map(); // publicId -> Set<socketId>
const status = new Map(); // publicId -> status (only while connected)
const kinds = new Map(); // publicId -> 'user' | 'guest'

export const presence = {
  add(key, kind, socketId) {
    if (!sockets.has(key)) sockets.set(key, new Set());
    sockets.get(key).add(socketId);
    kinds.set(key, kind);
    if (!status.has(key)) status.set(key, 'online');
  },

  /** Returns true when the actor has no sockets left. */
  remove(key, socketId) {
    const set = sockets.get(key);
    if (!set) return true;
    set.delete(socketId);
    if (set.size === 0) {
      sockets.delete(key);
      return true;
    }
    return false;
  },

  /** Called after grace handling decided the actor is really gone. */
  forget(key) {
    if (!sockets.has(key)) {
      status.delete(key);
      kinds.delete(key);
    }
  },

  set(key, s) {
    if (sockets.has(key)) status.set(key, s);
    else status.delete(key);
  },
  get(key) {
    return sockets.has(key) ? status.get(key) || 'online' : 'offline';
  },
  isOnline: (key) => sockets.has(key),
  socketIds: (key) => [...(sockets.get(key) || [])],

  counts() {
    let searching = 0;
    let inCall = 0;
    let guests = 0;
    for (const [key, s] of status) {
      if (!sockets.has(key)) continue;
      if (s === 'looking') searching += 1;
      if (s === 'in_call' || s === 'connecting' || s === 'partner_found') inCall += 1;
      if (kinds.get(key) === 'guest') guests += 1;
    }
    return { online: sockets.size, searching, inCall, guests };
  },
};
