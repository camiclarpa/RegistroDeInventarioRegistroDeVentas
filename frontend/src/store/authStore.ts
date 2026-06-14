import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, UserRole } from '@/types'
import { authService } from '@/services/authService'

interface AuthStore {
  user: User | null
  token: string | null
  isAuthenticated: boolean
  setAuth: (user: User, token: string) => void
  loadUser: () => Promise<void>
  logout: () => void
  hasRole: (...roles: UserRole[]) => boolean
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      isAuthenticated: false,

      setAuth: (user, token) => {
        const userData = user as any
        const userRole = (userData.roleName || userData.role || 'ADMIN') as string
        const normalizedUser = { 
          ...user, 
          role: userRole.toUpperCase() as UserRole 
        }
        console.log('🔐 setAuth - Role:', normalizedUser.role, 'User:', normalizedUser)
        set({ user: normalizedUser, token, isAuthenticated: true })
      },

      loadUser: async () => {
        try {
          const { token } = get()
          if (!token) {
            console.warn('No hay token para cargar usuario')
            return
          }

          const userData = await authService.me()
          console.log('📥 Datos de authService.me():', userData)

          const userDataAny = userData as any
          
          // ✅ CORREGIDO: Buscar roleName en múltiples ubicaciones
          let userRole = userDataAny.roleName || userDataAny.role
          
          // Si aún no hay role, intentar extraer del objeto original
          if (!userRole && userDataAny?.data) {
            userRole = userDataAny.data.roleName || userDataAny.data.role
          }
          
          if (!userRole) {
            console.warn('⚠️  No se encontró roleName, usando ADMIN por defecto')
            userRole = 'ADMIN'
          }

          const normalizedUser = {
            ...userData,
            roleName: userRole,
            role: userRole.toUpperCase() as UserRole
          }

          console.log('✅ Usuario normalizado - Role:', normalizedUser.role)
          set({ user: normalizedUser })
        } catch (error) {
          console.error('❌ Error cargando usuario:', error)
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },

      hasRole: (...roles) => {
        const { user } = get()
        if (!user) return false
        return roles.map(r => r.toUpperCase()).includes((user.role || '').toUpperCase())
      },
    }),
    {
      name: 'sigc-auth',
      partialize: (state) => ({ 
        user: state.user, 
        token: state.token, 
        isAuthenticated: state.isAuthenticated 
      }),
    }
  )
)
