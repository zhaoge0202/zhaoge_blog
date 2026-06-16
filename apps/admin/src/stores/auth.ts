import { defineStore } from 'pinia';
import { api } from '../lib/api';

type LoginData = {
  token: string;
  username: string;
  displayName: string;
};

export const useAuthStore = defineStore('auth', {
  state: () => ({
    token: localStorage.getItem('admin_token') ?? '',
    displayName: localStorage.getItem('admin_display_name') ?? '',
  }),
  actions: {
    async login(username: string, password: string) {
      const response = await api.post('/api/admin/auth/login', { username, password });
      const data = response.data.data as LoginData;
      this.token = data.token;
      this.displayName = data.displayName;
      localStorage.setItem('admin_token', data.token);
      localStorage.setItem('admin_display_name', data.displayName);
    },
    logout() {
      this.token = '';
      this.displayName = '';
      localStorage.removeItem('admin_token');
      localStorage.removeItem('admin_display_name');
    },
  },
});
