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
        // Normalizar role a mayúsculas para comparación consistente
        const normalizedUser = { ...user, role: (user.role as string).toUpperCase() as UserRole }
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
          
          // Normalizar role a mayúsculas
          const normalizedUser = { 
            ...userData, 
            role: (userData.role as string).toUpperCase() as UserRole 
          }
          
          set({ user: normalizedUser })
          console.log('✅ Usuario cargado:', normalizedUser)
        } catch (error) {
          console.error('❌ Error cargando usuario:', error)
          // No hacemos logout automático aquí para evitar loops
        }
      },

      logout: () => {
        set({ user: null, token: null, isAuthenticated: false })
      },

      hasRole: (...roles) => {
        const { user } = get()
        if (!user) return false
        // Case-insensitive comparison
        return roles.map(r => r.toUpperCase()).includes((user.role || '').toUpperCase())
      },
    }),
    {
      name: 'sigc-auth',
      partialize: (state) => ({ user: state.user, token: state.token, isAuthenticated: state.isAuthenticated }),
    }
  )
)
