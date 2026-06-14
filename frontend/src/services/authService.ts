import api from './api'
import type { User } from '@/types'

export interface LoginResponse {
  token: string
  user: User
}

export const authService = {
  login: async (credentials: { email: string; password: string }): Promise<LoginResponse> => {
    try {
      const { data } = await api.post('/auth/login', credentials)
      if (data.token && data.user) return data
      if (data.data?.token && data.data?.user) return data.data
      if (data.accessToken) return { token: data.accessToken, user: data.user ?? data.data?.user }
      return data
    } catch {
      const { data } = await api.post('/security/login', credentials)
      if (data.token && data.user) return data
      if (data.data?.token) return data.data
      return data
    }
  },

  // ✅ CORREGIDO: Extraer datos correctamente del formato del backend
  me: async (): Promise<User> => {
    try {
      const { data } = await api.get('/auth/me')
      // Backend retorna: { success: true, data: { user data } }
      // Extraer el objeto de usuario correctamente
      if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
        return data.data as User
      }
      if (data?.user) return data.user as User
      return data as User
    } catch {
      const { data } = await api.get('/security/me')
      if (data?.data && typeof data.data === 'object' && !Array.isArray(data.data)) {
        return data.data as User
      }
      if (data?.user) return data.user as User
      return data as User
    }
  },

  changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
    await api.post('/auth/change-password', { currentPassword, newPassword })
  },
}
