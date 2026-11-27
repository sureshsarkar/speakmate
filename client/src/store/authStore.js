import { create } from 'zustand';
import { api } from '../lib/api';
import { disconnectSocket, connectSocket } from '../lib/socket';
import { engine } from '../lib/callEngine';
import { useAppStore } from './appStore';

const KEY = 'sm_token';
const REMEMBER = 'sm_remember';

const read = () => {
  try {
    return localStorage.getItem(KEY) || sessionStorage.getItem(KEY) || null;
  } catch {
    return null;
  }
};
const write = (token, remember) => {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
    (remember ? localStorage : sessionStorage).setItem(KEY, token);
    localStorage.setItem(REMEMBER, remember ? '1' : '0');
  } catch {
    /* storage blocked: the session just will not persist */
  }
};
const clear = () => {
  try {
    localStorage.removeItem(KEY);
    sessionStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
};

export const useAuthStore = create((set, get) => ({
  token: read(),
  user: null,
  ready: false, // true once we know whether the stored token is valid

  /** Called on app start: validates the stored token and opens the socket. */
  async init() {
    const token = get().token;
    if (!token) return set({ ready: true });
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user, ready: true });
      connectSocket();
    } catch (e) {
      // network failure: keep the token and let the user retry; auth failure: interceptor already logged out
      if (!e.response) set({ ready: true });
      else if (get().token) get().logout();
      else set({ ready: true });
    }
  },

  setSession({ token, user }, remember = true) {
    write(token, remember);
    set({ token, user, ready: true });
    connectSocket();
  },

  setUser: (user) => set({ user }),

  async refresh() {
    try {
      const { data } = await api.get('/auth/me');
      set({ user: data.user });
      return data.user;
    } catch {
      return get().user;
    }
  },

  logout(message) {
    if (get().token) api.post('/auth/logout').catch(() => {});
    engine.hardReset();
    disconnectSocket();
    clear();
    set({ token: null, user: null, ready: true });
    if (message) useAppStore.getState().toast(message, 'error');
  },
}));
