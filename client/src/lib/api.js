import axios from 'axios';
import { useAuthStore } from '../store/authStore';
import { useAppStore } from '../store/appStore';

const baseURL = (import.meta.env.VITE_API_URL || '') + '/api';

export const api = axios.create({ baseURL, timeout: 20000 });

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  config.headers['X-Timezone-Offset'] = String(new Date().getTimezoneOffset());
  return config;
});

api.interceptors.response.use(
  (r) => r,
  (error) => {
    const data = error.response?.data;
    if (error.response?.status === 401 && ['TOKEN_INVALID', 'UNAUTHORIZED'].includes(data?.code)) {
      useAuthStore.getState().logout(data.message);
    }
    if (error.response?.status === 403 && ['ACCOUNT_BLOCKED', 'ACCOUNT_SUSPENDED'].includes(data?.code)) {
      useAuthStore.getState().logout(data.message);
    }
    if (error.response?.status === 503 && data?.code === 'MAINTENANCE') {
      useAppStore.getState().setMaintenance({ enabled: true, message: data.message });
    }
    return Promise.reject(error);
  }
);

/** Human readable message from any axios/Error value. */
export function errMsg(e, fallback = 'Something went wrong. Please try again.') {
  if (e?.response?.data?.message) return e.response.data.message;
  if (e?.code === 'ECONNABORTED') return 'The server took too long to respond.';
  if (e?.message === 'Network Error') return 'Cannot reach the server. Check your connection.';
  return e?.message && typeof e.message === 'string' && !e.response ? e.message : fallback;
}
export const errCode = (e) => e?.response?.data?.code;
