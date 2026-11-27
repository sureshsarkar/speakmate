import axios from 'axios';
import { useAdminStore } from '../store/adminStore';

export const adminApi = axios.create({ baseURL: (import.meta.env.VITE_API_URL || '') + '/api/admin', timeout: 20000 });

adminApi.interceptors.request.use((config) => {
  const token = useAdminStore.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

adminApi.interceptors.response.use(
  (r) => r,
  (error) => {
    if (error.response?.status === 401 && error.response?.data?.code === 'ADMIN_UNAUTHORIZED') {
      useAdminStore.getState().logout();
    }
    return Promise.reject(error);
  }
);
