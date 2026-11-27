import { create } from 'zustand';

const KEY = 'sm_admin_token';
const read = () => {
  try {
    return sessionStorage.getItem(KEY);
  } catch {
    return null;
  }
};

// Admin sessions live in sessionStorage only: closing the tab signs the admin out.
export const useAdminStore = create((set) => ({
  token: read(),
  admin: null,
  setSession({ token, admin }) {
    try {
      sessionStorage.setItem(KEY, token);
    } catch {
      /* ignore */
    }
    set({ token, admin });
  },
  setAdmin: (admin) => set({ admin }),
  logout() {
    try {
      sessionStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    set({ token: null, admin: null });
  },
}));
