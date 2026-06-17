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

function clearStoredAuth() {
  localStorage.removeItem('admin_token');
  localStorage.removeItem('admin_display_name');
}

function extractErrorMessage(error: unknown, fallback: string): never {
  if (axios.isAxiosError(error)) {
    const message = (error.response?.data as { message?: string } | undefined)?.message;
    throw new Error(message || error.message || fallback);
  }
  throw error instanceof Error ? error : new Error(fallback);
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isAxiosError(error) && (error.response?.status === 401 || error.response?.status === 403)) {
      const hadToken = Boolean(localStorage.getItem('admin_token'));
      clearStoredAuth();
      if (hadToken && window.location.pathname !== '/login') {
        window.location.assign('/login');
      }
    }
    return Promise.reject(error);
  },
);

export async function apiGet<T>(path: string): Promise<T> {
  try {
    const response = await api.get<ApiResponse<T>>(path);
    return response.data.data;
  } catch (error) {
    extractErrorMessage(error, `请求失败: GET ${path}`);
  }
}

export async function apiPost<T, P = unknown>(path: string, payload: P): Promise<T> {
  try {
    const response = await api.post<ApiResponse<T>>(path, payload);
    return response.data.data;
  } catch (error) {
    extractErrorMessage(error, `请求失败: POST ${path}`);
  }
}

export async function apiPut<T, P = unknown>(path: string, payload: P): Promise<T> {
  try {
    const response = await api.put<ApiResponse<T>>(path, payload);
    return response.data.data;
  } catch (error) {
    extractErrorMessage(error, `请求失败: PUT ${path}`);
  }
}

export async function apiPatch<T, P = unknown>(path: string, payload?: P): Promise<T> {
  try {
    const response = await api.patch<ApiResponse<T>>(path, payload);
    return response.data.data;
  } catch (error) {
    extractErrorMessage(error, `请求失败: PATCH ${path}`);
  }
}
