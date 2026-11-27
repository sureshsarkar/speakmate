import { io } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

let socket = null;
const listeners = new Set(); // callbacks invoked with each new socket instance

const url = import.meta.env.VITE_SOCKET_URL || undefined; // same origin by default (Vite proxies in dev)

export function getSocket() {
  return socket;
}

/** Subscribe to socket (re)creation so engines can attach their handlers. */
export function onSocketCreated(cb) {
  listeners.add(cb);
  if (socket) cb(socket);
  return () => listeners.delete(cb);
}

export function connectSocket() {
  if (socket) return socket;
  socket = io(url, {
    // Fresh token on every (re)connect attempt
    auth: (cb) => cb({ token: useAuthStore.getState().token, tz: new Date().getTimezoneOffset() }),
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 700,
    reconnectionDelayMax: 5000,
  });
  listeners.forEach((cb) => cb(socket));
  return socket;
}

export function disconnectSocket() {
  if (socket) {
    socket.removeAllListeners();
    socket.disconnect();
    socket = null;
  }
}
