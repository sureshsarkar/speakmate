import { create } from 'zustand';
import { api } from '../lib/api';
import { applyTheme } from '../lib/theme';

let toastId = 0;

export const useAppStore = create((set, get) => ({
  config: null,
  configError: false,
  maintenance: { enabled: false, message: '' },
  online: { online: 0, searching: 0, inCall: 0 },
  toasts: [],
  unread: 0,
  socketState: 'idle', // idle | connected | reconnecting

  async loadConfig() {
    try {
      const { data } = await api.get('/config');
      applyTheme(data.config.theme);
      document.title = `${data.config.appName} - Speak English With The World`;
      set({ config: data.config, maintenance: data.config.maintenance, configError: false });
    } catch {
      set({ configError: true });
    }
  },

  setMaintenance: (maintenance) => set({ maintenance }),
  setOnline: (online) => set({ online }),
  setUnread: (unread) => set({ unread }),
  bumpUnread: () => set({ unread: get().unread + 1 }),
  setSocketState: (socketState) => set({ socketState }),

  toast(message, type = 'info', ms = 4200) {
    const id = ++toastId;
    set({ toasts: [...get().toasts, { id, message, type }].slice(-3) });
    setTimeout(() => get().dismissToast(id), ms);
  },
  dismissToast: (id) => set({ toasts: get().toasts.filter((t) => t.id !== id) }),
}));
