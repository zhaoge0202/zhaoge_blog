import axios from 'axios';

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  message: string;
};

export type PageResponse<T> = {
  records: T[];
  total: number;
  page: number;
  size: number;
};

export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE ?? 'http://localhost:8080',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export async function apiGet<T>(path: string): Promise<T> {
  const response = await api.get<ApiResponse<T>>(path);
  return response.data.data;
}
