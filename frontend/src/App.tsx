import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { Layout } from '@/components/layout/Layout'
import { Spinner } from '@/components/ui/Spinner'

// Lazy pages
const Login           = lazy(() => import('@/pages/Login'))
const Dashboard       = lazy(() => import('@/pages/Dashboard'))
const Inventory       = lazy(() => import('@/pages/Inventory'))
const POS             = lazy(() => import('@/pages/POS'))
const Invoices        = lazy(() => import('@/pages/Invoices'))
const Purchases       = lazy(() => import('@/pages/Purchases'))
const Treasury        = lazy(() => import('@/pages/Treasury'))
const Reports         = lazy(() => import('@/pages/Reports'))
const Security        = lazy(() => import('@/pages/Security'))
const Credits         = lazy(() => import('@/pages/Credits'))
const CRM             = lazy(() => import('@/pages/CRM'))
const CRMPro          = lazy(() => import('@/pages/crm/CRMPro'))
const PrintTicketInvoicePage = lazy(() => import('@/pages/PrintTicketInvoicePage'))
const PrintTicketPage = lazy(() => import('@/pages/PrintTicketPage'))
const Settings        = lazy(() => import('@/pages/Settings'))
const Classifications = lazy(() => import('@/pages/Classifications'))
const Labels          = lazy(() => import('@/pages/Labels'))
const NotFound        = lazy(() => import('@/pages/NotFound'))
const CustomerDetailPage = lazy(() => import('./pages/crm/customers/CustomerDetailPage'));
const CRMAnalyticsPage = lazy(() => import('./pages/crm/analytics/CRMAnalyticsPage'));
const CampaignsPage = lazy(() => import('./pages/crm/campaigns/CampaignsPage'));
const WorkshopPage = lazy(() => import('./pages/crm/workshop/WorkshopPage'));
const QuotesPage = lazy(() => import('./pages/crm/quotes/QuotesPage'));
const TicketsPage = lazy(() => import('./pages/crm/tickets/TicketsPage'));
const CommunicationsPage = lazy(() => import('./pages/crm/communications/CommunicationsPage'));

const PageLoader = () => (
  <div className="flex items-center justify-center h-64">
    <Spinner size="lg" />
  </div>
)

// Protected route wrapper - CASE INSENSITIVE COMPARISON
const ProtectedRoute = ({ children, roles }: { children: React.ReactNode; roles?: string[] }) => {
  const { isAuthenticated, user } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  
  // Case-insensitive role comparison
  if (roles && user) {
    const userRole = (user.role || '').toUpperCase()
    const allowedRoles = roles.map(r => r.toUpperCase())
    if (!allowedRoles.includes(userRole)) {
      return <Navigate to="/inventory" replace />
    }
  }
  return <>{children}</>
}

// Unauthorized redirect listener
const AuthListener = () => {
  const navigate = useNavigate()
  const { logout } = useAuthStore()
  useEffect(() => {
    const handler = () => { logout(); navigate('/login') }
    window.addEventListener('sigc:unauthorized', handler)
    return () => window.removeEventListener('sigc:unauthorized', handler)
  }, [logout, navigate])
  return null
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthListener />
      <Toaster position="top-right" richColors closeButton toastOptions={{ duration: 4000 }} />
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/login" element={<Login />} />
          <Route path="/print-ticket/:saleId" element={<PrintTicketPage />} />
          <Route path="/print-ticket-invoice/:invoiceId" element={<PrintTicketInvoicePage />} />

          {/* Protected — with layout */}
          <Route element={<ProtectedRoute><Layout /></ProtectedRoute>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<ProtectedRoute roles={['ADMIN']}><Dashboard /></ProtectedRoute>} />
            <Route path="/inventory" element={<Inventory />} />
            <Route path="/pos" element={<ProtectedRoute roles={['ADMIN', 'SELLER']}><POS /></ProtectedRoute>} />
            <Route path="/invoices" element={<ProtectedRoute roles={['ADMIN', 'SELLER']}><Invoices /></ProtectedRoute>} />
            <Route path="/purchases" element={<ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}><Purchases /></ProtectedRoute>} />
            <Route path="/treasury" element={<ProtectedRoute roles={['ADMIN']}><Treasury /></ProtectedRoute>} />
            <Route path="/reports" element={<ProtectedRoute roles={['ADMIN']}><Reports /></ProtectedRoute>} />
            <Route path="/security" element={<ProtectedRoute roles={['ADMIN']}><Security /></ProtectedRoute>} />
            <Route path="/credits" element={<Navigate to="/crm/customers" replace />} />
            <Route path="/crm" element={<ProtectedRoute roles={['ADMIN', 'SELLER']}><CRMPro /></ProtectedRoute>}>
              <Route index element={<Navigate to="/crm/customers" replace />} />
              <Route path="customers" element={<CRM />} />
              <Route path="customers/:id" element={<CustomerDetailPage />} />
              <Route path="analytics" element={<CRMAnalyticsPage />} />
              <Route path="communications" element={<CommunicationsPage />} />
              <Route path="tickets" element={<TicketsPage />} />
              <Route path="quotes" element={<QuotesPage />} />
              <Route path="workshop" element={<WorkshopPage />} />
              <Route path="campaigns" element={<CampaignsPage />} />
            </Route>
            <Route path="/classifications" element={<ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}><Classifications /></ProtectedRoute>} />
            <Route path="/labels" element={<ProtectedRoute roles={['ADMIN', 'WAREHOUSE']}><Labels /></ProtectedRoute>} />
            <Route path="/settings" element={<ProtectedRoute roles={['ADMIN']}><Settings /></ProtectedRoute>} />
          </Route>

          {/* 404 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
