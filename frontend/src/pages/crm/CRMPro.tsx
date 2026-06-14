import { useState } from 'react';
import { Outlet, NavLink, useLocation, Navigate } from 'react-router-dom';
import {
  BarChart2, MessageSquare, Ticket, FileText, Wrench, Megaphone,
  ChevronLeft, ChevronRight, Sparkles, Menu, X, Users,
} from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { cn } from '@/utils/helpers';

interface CrmSection {
  id:     string;
  label:  string;
  path:   string;
  icon:   React.ReactNode;
  roles:  string[];
}

const CRM_SECTIONS: CrmSection[] = [
  { id: 'customers',      label: 'Clientes',         path: '/crm/customers',      icon: <Users size={18} />,         roles: ['ADMIN', 'SELLER'] },
  { id: 'analytics',      label: 'Analítica',       path: '/crm/analytics',      icon: <BarChart2 size={18} />,      roles: ['ADMIN', 'SELLER'] },
  { id: 'communications', label: 'Comunicaciones',  path: '/crm/communications', icon: <MessageSquare size={18} />, roles: ['ADMIN', 'SELLER'] },
  { id: 'tickets',        label: 'Tickets',          path: '/crm/tickets',        icon: <Ticket size={18} />,        roles: ['ADMIN', 'SELLER'] },
  { id: 'quotes',         label: 'Cotizaciones',    path: '/crm/quotes',         icon: <FileText size={18} />,      roles: ['ADMIN', 'SELLER'] },
  { id: 'workshop',       label: 'Taller',           path: '/crm/workshop',       icon: <Wrench size={18} />,        roles: ['ADMIN', 'SELLER'] },
  { id: 'campaigns',      label: 'Campañas',         path: '/crm/campaigns',      icon: <Megaphone size={18} />,     roles: ['ADMIN'] },
];

export default function CRMProLayout() {
  const { user }      = useAuthStore();
  const location      = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  if (!user) return <Navigate to="/login" replace />;

  const userRole     = (user.role ?? '').toUpperCase();
  const allowedSects = CRM_SECTIONS.filter(s => s.roles.includes(userRole));
  const activeSection = allowedSects.find(s => location.pathname.startsWith(s.path));

  return (
    <div className="flex h-full min-h-0 bg-gray-50">
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-black/40 lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sub-sidebar */}
      <aside
        className={cn(
          'flex-shrink-0 bg-white border-r border-gray-200 flex flex-col transition-all duration-200 z-40',
          'fixed lg:relative inset-y-0 left-0',
          collapsed  ? 'w-14' : 'w-52',
          mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0',
        )}
        style={{ top: 0, bottom: 0 }}
      >
        {/* Header */}
        <div className={cn(
          'flex items-center gap-2 px-3 py-4 border-b border-gray-100 flex-shrink-0',
          collapsed && 'justify-center',
        )}>
          <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center flex-shrink-0">
            <Sparkles size={14} className="text-white" />
          </div>
          {!collapsed && (
            <div>
              <p className="text-sm font-bold text-gray-900 leading-tight">CRM Pro</p>
              <p className="text-xs text-gray-400 leading-tight">Gestión avanzada</p>
            </div>
          )}
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-2 px-2 space-y-0.5">
          {allowedSects.map(section => (
            <NavLink
              key={section.id}
              to={section.path}
              onClick={() => setMobileOpen(false)}
              className={({ isActive }) => cn(
                'flex items-center gap-2.5 px-2.5 py-2 rounded-lg text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900',
                collapsed && 'justify-center px-2',
              )}
              title={collapsed ? section.label : undefined}
            >
              <span className="flex-shrink-0 w-[18px] h-[18px]">{section.icon}</span>
              {!collapsed && <span className="truncate">{section.label}</span>}
            </NavLink>
          ))}
        </nav>

        {/* Collapse toggle */}
        <div className="flex-shrink-0 border-t border-gray-100 p-2">
          <button
            onClick={() => setCollapsed(c => !c)}
            className="hidden lg:flex w-full items-center justify-center p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-50 text-xs gap-1"
          >
            {collapsed
              ? <ChevronRight size={15} />
              : <><ChevronLeft size={15} /> <span>Colapsar</span></>
            }
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white border-b border-gray-200">
          <button
            onClick={() => setMobileOpen(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-semibold text-gray-800">
            {activeSection?.label ?? 'CRM Pro'}
          </span>
        </div>

        {/* Page header (desktop) */}
        <div className="hidden lg:flex items-center gap-3 px-6 py-4 bg-white border-b border-gray-200 flex-shrink-0">
          <span className="text-gray-400">{activeSection?.icon}</span>
          <h1 className="text-lg font-semibold text-gray-900">{activeSection?.label ?? 'CRM Pro'}</h1>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </div>
    </div>
  );
}
