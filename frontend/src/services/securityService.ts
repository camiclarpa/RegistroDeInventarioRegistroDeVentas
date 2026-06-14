import api from './api'
import type { User, AuditLog, PaginatedResponse } from '@/types'

export interface CreateUserPayload {
  name: string
  email: string
  password: string
  role: 'ADMIN' | 'SELLER' | 'WAREHOUSE'
}

export interface UpdateUserPayload {
  name?: string
  email?: string
  role?: 'ADMIN' | 'SELLER' | 'WAREHOUSE'
  isActive?: boolean
  password?: string
}

export const securityService = {
      getUsers: async (): Promise<User[]> => {
    const response = await api.get('/security/users')
    // Axios + interceptor: response.data puede ser:
    // 1. { users: [...], total: N } (ya procesado por interceptor)
    // 2. { success: true,  { users: [...], total: N } } (raw)
    // 3. [...] (array directo)
    const result = response.data
    let users: any[] = []
    
    if (Array.isArray(result)) {
      users = result
    } else if (result?.users && Array.isArray(result.users)) {
      users = result.users  // Caso más común con interceptor
    } else if (result?.data?.users && Array.isArray(result.data.users)) {
      users = result.data.users  // Caso raw sin interceptor
    }
    
    if (!Array.isArray(users)) return []

    // Normalizar el rol: usar roleName si está disponible
    return users.map((u: any) => ({
      ...u,
      role: u.roleName ?? (typeof u.role === 'object' && u.role !== null ? u.role.name : u.role) ?? 'SELLER'
    }))
  },

  createUser: async (payload: CreateUserPayload): Promise<User> => {
    const response = await api.post('/security/users', payload)
    // Backend retorna { success: true,  { user: {...} } }
    return response.data?.data?.user ?? response.data?.user ?? response.data
  },

  updateUser: async (id: string, payload: UpdateUserPayload): Promise<User> => {
    const response = await api.put(`/security/users/${id}`, payload)
    return response.data?.data?.user ?? response.data?.user ?? response.data
  },

  toggleUserStatus: async (id: string, isActive: boolean): Promise<User> => {
    const response = await api.patch(`/security/users/${id}/status`, { isActive })
    return response.data?.data?.user ?? response.data?.user ?? response.data
  },

  getAuditLogs: async (params: { page?: number; limit?: number; userId?: string; startDate?: string; endDate?: string } = {}): Promise<PaginatedResponse<AuditLog>> => {
    const response = await api.get('/security/audit-logs', { params })
    const data = response.data?.data ?? response.data
    if (Array.isArray(data)) {
      return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 }
    }
    if (data?.logs) {
      return { 
        data: data.logs, 
        total: data.total ?? data.logs.length, 
        page: data.page ?? 1, 
        limit: data.limit ?? 50, 
        totalPages: data.totalPages ?? 1 
      }
    }
    return data
  },
}
