import { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Package, ShoppingCart, FileText,
  ShoppingBag, Landmark, BarChart3, Shield, ChevronLeft,
  ChevronRight, Bike, CreditCard, Tag, Settings,
} from 'lucide-react'
import { cn } from '@/utils/helpers'
import { useAuthStore } from '@/store/authStore'
import { useAppStore } from '@/store/appStore'

interface NavItem {
  label: string
  path: string
  icon: React.ReactNode
  roles?: string[]
  permissions?: string[]
}

const navItems: NavItem[] = [
  { label: 'Dashboard', path: '/dashboard', icon: <LayoutDashboard />, roles: ['ADMIN', 'admin', 'ADMINISTRATOR'] },
  { label: 'Inventario', path: '/inventory', icon: <Package /> },
  { label: 'Punto de Venta', path: '/pos', icon: <ShoppingCart />, roles: ['ADMIN', 'admin', 'SELLER', 'seller'] },
  { label: 'Facturas', path: '/invoices', icon: <FileText />, roles: ['ADMIN', 'admin', 'SELLER', 'seller'] },
  { label: 'Compras', path: '/purchases', icon: <ShoppingBag />, roles: ['ADMIN', 'admin', 'WAREHOUSE', 'warehouse'] },
  { label: 'Tesorería', path: '/treasury', icon: <Landmark />, roles: ['ADMIN', 'admin'] },
  { label: 'Créditos', path: '/credits', icon: <CreditCard />, roles: ['ADMIN', 'admin', 'SELLER', 'seller'] },
  { label: 'Reportes', path: '/reports', icon: <BarChart3 />, roles: ['ADMIN', 'admin'] },
  { label: 'Seguridad', path: '/security', icon: <Shield />, roles: ['ADMIN', 'admin'] },
  { label: 'Clasificaciones', path: '/classifications', icon: <Tag />, roles: ['ADMIN', 'admin', 'WAREHOUSE', 'warehouse'] },
  { label: 'Ajustes', path: '/settings', icon: <Settings />, roles: ['ADMIN', 'admin'] },
]

export const Sidebar = () => {
  const { user } = useAuthStore()
  const { sidebarCollapsed, setSidebarCollapsed } = useAppStore()
  const location = useLocation()
  const [logoLoaded, setLogoLoaded] = useState(true)

  // DEBUG: Log en consola para diagnosticar
  useEffect(() => {
    console.log('🔍 Sidebar Debug:', {
      userRole: user?.role,
      userPermissions: user?.permissions,
      expectedRoles: navItems.map(i => ({ label: i.label, roles: i.roles }))
    })
  }, [user])

  const allowed = navItems.filter((item) => {
    // Si no tiene roles definidos, mostrar siempre
    if (!item.roles || item.roles.length === 0) return true
    
    // Si no hay usuario, ocultar
    if (!user) return false
    
    // Normalizar rol a mayúsculas para comparación
    const userRole = (user.role || '').toUpperCase()
    const itemRoles = item.roles.map(r => r.toUpperCase())
    
    const hasRole = itemRoles.includes(userRole)
    
    // DEBUG: Log de filtrado
    console.log(`🔐 ${item.label}: role="${user.role}" vs [${item.roles}] → ${hasRole ? '✅' : '❌'}`)
    
    return hasRole
  })

  console.log('📋 Módulos permitidos:', allowed.map(i => i.label))

  return (
    <aside
      className={cn(
        'fixed left-0 top-0 h-full bg-blue-900 text-white flex flex-col z-40 transition-all duration-300',
        sidebarCollapsed ? 'w-16' : 'w-64'
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-blue-800 flex-shrink-0 min-h-[72px]">
        {logoLoaded ? (
          <img
            src="/uploads/logo.png"
            alt="Logo Clavijos Motos"
            className="h-10 w-auto object-contain flex-shrink-0"
            onError={() => setLogoLoaded(false)}
          />
        ) : (
          <div className="w-10 h-10 bg-orange-500 rounded-lg flex items-center justify-center flex-shrink-0">
            <Bike className="w-6 h-6 text-white" />
          </div>
        )}
        {!sidebarCollapsed && (
          <div className="overflow-hidden">
            <p className="font-bold text-sm leading-tight truncate">SIGC-Motos</p>
            <p className="text-blue-300 text-xs truncate">Clavijos Motos</p>
          </div>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-3 px-2 space-y-0.5">
        {allowed.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) =>
              cn(
                'flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                isActive
                  ? 'bg-orange-500 text-white shadow-sm'
                  : 'text-blue-100 hover:bg-blue-800 hover:text-white'
              )
            }
            title={sidebarCollapsed ? item.label : undefined}
          >
            <span className="w-5 h-5 flex-shrink-0 [&>svg]:w-5 [&>svg]:h-5">{item.icon}</span>
            {!sidebarCollapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}
      </nav>

      {/* Footer */}
      {!sidebarCollapsed && (
        <div className="flex-shrink-0 px-4 py-2 border-t border-blue-800">
          <p className="text-blue-400 text-xs leading-tight">SIGC-Motos v2.0</p>
          <p className="text-blue-500 text-xs">Powered by Quanta Cloud</p>
        </div>
      )}

      {/* Collapse toggle */}
      <div className="flex-shrink-0 border-t border-blue-800 p-2">
        <button
          onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
          className="w-full flex items-center justify-center p-2 rounded-lg hover:bg-blue-800 text-blue-300 hover:text-white transition-colors"
          title={sidebarCollapsed ? 'Expandir' : 'Colapsar'}
        >
          {sidebarCollapsed ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
          {!sidebarCollapsed && <span className="ml-2 text-sm">Colapsar</span>}
        </button>
      </div>
    </aside>
  )
}
