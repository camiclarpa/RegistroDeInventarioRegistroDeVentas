import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Eye, EyeOff, Bike, Lock, Mail } from 'lucide-react'
import { toast } from 'sonner'
import { authService } from '@/services/authService'
import { useAuthStore } from '@/store/authStore'
import { loginSchema, type LoginInput } from '@/utils/validators'
import { Spinner } from '@/components/ui/Spinner'

export default function Login() {
  const navigate = useNavigate()
  const { setAuth, loadUser } = useAuthStore()
  const [showPw, setShowPw] = useState(false)
  const [loading, setLoading] = useState(false)

  const { register, handleSubmit, formState: { errors } } = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
  })

  const onSubmit = async (data: LoginInput) => {
    setLoading(true)
    console.log('🔐 Login started')
    
    try {
      // 1. Login
      console.log('📤 Calling authService.login...')
      const response = await authService.login(data as any)
      console.log('✅ Login response:', { hasToken: !!response.token, user: response.user })
      
      // 2. Save auth
      console.log('💾 Calling setAuth...')
      setAuth(response.user, response.token)
      
      // 3. CRITICAL: Load user permissions
      console.log('🔄 Calling loadUser...')
      await loadUser()
      
      // 4. Verify
      const currentUser = useAuthStore.getState().user
      console.log('📊 Current user after loadUser:', {
        role: currentUser?.role,
        permissions: currentUser?.permissions?.length || 0
      })
      
      toast.success(`¡Bienvenido, ${response.user.name}!`)
      
      // 5. Navigate with delay
      setTimeout(() => {
        console.log('🚀 Navigating to /dashboard')
        navigate('/dashboard', { replace: true })
      }, 300)
      
    } catch (err: any) {
      console.error('❌ Login error:', err)
      const msg = err?.response?.data?.error || err?.message || 'Credenciales incorrectas'
      toast.error(msg)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-blue-900 to-blue-800 flex items-center justify-center p-4">
      <div className="absolute inset-0 opacity-5 pointer-events-none" style={{
        backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)',
        backgroundSize: '32px 32px',
      }} />
      
      <div className="relative w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-orange-500 rounded-2xl mb-4">
            <Bike className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white mb-2">SIGC-Motos</h1>
          <p className="text-blue-200">Clavijos Motos S.A.S.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="bg-white rounded-2xl shadow-xl p-8 space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Mail className="inline w-4 h-4 mr-1" />
              Correo electrónico
            </label>
            <input
              type="email"
              {...register('email')}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="admin@clavijosmotos.com"
            />
            {errors.email && <p className="mt-1 text-sm text-red-600">{errors.email.message}</p>}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              <Lock className="inline w-4 h-4 mr-1" />
              Contraseña
            </label>
            <div className="relative">
              <input
                type={showPw ? 'text' : 'password'}
                {...register('password')}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
              >
                {showPw ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
            {errors.password && <p className="mt-1 text-sm text-red-600">{errors.password.message}</p>}
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-900 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3 rounded-lg transition-colors flex items-center justify-center"
          >
            {loading ? (
              <>
                <Spinner size="sm" />
                <span className="ml-2">Iniciando sesión...</span>
              </>
            ) : (
              'Iniciar sesión'
            )}
          </button>
        </form>

        <p className="text-center text-blue-200 text-sm mt-6">
          SIGC-Motos v2.0 - Powered by Quanta Cloud
        </p>
      </div>
    </div>
  )
}
