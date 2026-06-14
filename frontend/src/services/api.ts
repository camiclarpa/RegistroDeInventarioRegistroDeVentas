import axios, { InternalAxiosRequestConfig, AxiosError } from 'axios';

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: { 'Content-Type': 'application/json' },
  // CLAVE EMPRESARIAL: Permite enviar y recibir cookies HttpOnly automáticamente
  withCredentials: true, 
});

let isRefreshing = false;
let failedQueue: { resolve: (value?: unknown) => void; reject: (reason?: any) => void }[] = [];

const processQueue = (error: any, token: string | null = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

// 1. Interceptor de Petición: Adjunta el Access Token (guardado en memoria/localStorage de forma ligera)
api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  try {
    if (typeof window !== 'undefined') {
      // Leemos el token de acceso actual (no el refresh, ese lo maneja el navegador)
      const authStorage = localStorage.getItem('sigc-auth');
      if (authStorage) {
        const parsed = JSON.parse(authStorage);
        const token = parsed?.state?.token || parsed?.token;
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
    }
  } catch (error) {
    console.error('❌ INTERCEPTOR - Error al extraer token:', error);
  }
  return config;
});

// 2. Interceptor de Respuesta: Auto-Refresh Silencioso
api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as any;

    // Si es 401 y no es la propia petición de refresh
    if (error.response?.status === 401 && !originalRequest._retry) {
      if (originalRequest.url?.includes('/auth/refresh')) {
        // Si el refresh falla, la sesión murió de verdad
        localStorage.removeItem('sigc-auth');
        window.dispatchEvent(new CustomEvent('sigc:unauthorized'));
        return Promise.reject(error);
      }

      originalRequest._retry = true;

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      isRefreshing = true;

      try {
        console.log('🔄 Token expirado. Renovando silenciosamente con Cookie HttpOnly...');
        // El navegador envía la cookie 'refreshToken' AUTOMÁTICAMENTE gracias a withCredentials: true
        const response = await axios.post(`${API_BASE_URL}/auth/refresh`, {}, { withCredentials: true });
        
        const newAccessToken = response.data.data?.token || response.data.token;
        
        // Actualizamos solo el access token en localStorage
        const authStorage = localStorage.getItem('sigc-auth');
        if (authStorage) {
          const parsed = JSON.parse(authStorage);
          parsed.state.token = newAccessToken;
          parsed.token = newAccessToken;
          localStorage.setItem('sigc-auth', JSON.stringify(parsed));
        }

        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
        processQueue(null, newAccessToken);
        
        console.log('✅ Token renovado. Reintentando petición original...');
        return api(originalRequest);
      } catch (refreshError: any) {
        processQueue(refreshError, null);
        localStorage.removeItem('sigc-auth');
        window.dispatchEvent(new CustomEvent('sigc:unauthorized'));
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export default api;
