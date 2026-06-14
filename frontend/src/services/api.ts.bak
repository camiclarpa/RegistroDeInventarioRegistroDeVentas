import axios, { AxiosInstance } from 'axios'

const API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL || '/api/v1'

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  try {
    if (typeof window !== 'undefined') {
      const authStorage = localStorage.getItem('sigc-auth')
      if (authStorage) {
        const parsed = JSON.parse(authStorage)
        const token = parsed?.state?.token
        if (token) {
          config.headers.Authorization = `Bearer ${token}`
        }
      }
    }
  } catch (e) { /* ignore */ }
  return config
})

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent('sigc:unauthorized'))
    }
    return Promise.reject(error)
  }
)

export default api
