// Format currency in Colombian pesos
export const formatCOP = (amount: number | string | null | undefined): string => {
  if (amount === null || amount === undefined) return '$0'
  const num = typeof amount === 'string' ? parseFloat(amount) : amount
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num)
}

// Format number with thousand separators
export const formatNumber = (n: number | null | undefined): string => {
  if (n === null || n === undefined) return '0'
  return new Intl.NumberFormat('es-CO').format(n)
}

// Format date as dd/mm/yyyy - ✅ AHORA MANEJA null/undefined
export const formatDate = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '—'  // ✅ Manejo seguro de null/undefined
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (isNaN(d.getTime())) return '—'  // ✅ Manejo de fecha inválida
    return d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  } catch {
    return '—'  // ✅ Fallback seguro
  }
}

// Format datetime - ✅ AHORA MANEJA null/undefined
export const formatDateTime = (dateStr: string | Date | null | undefined): string => {
  if (!dateStr) return '—'  // ✅ Manejo seguro de null/undefined
  try {
    const d = typeof dateStr === 'string' ? new Date(dateStr) : dateStr
    if (isNaN(d.getTime())) return '—'  // ✅ Manejo de fecha inválida
    return d.toLocaleString('es-CO', {
      day: '2-digit', month: '2-digit', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    })
  } catch {
    return '—'  // ✅ Fallback seguro
  }
}

// Format percentage
export const formatPct = (n: number | null | undefined, decimals = 1): string => {
  if (n === null || n === undefined) return '0%'
  return `${n.toFixed(decimals)}%`
}

// Stock badge color
export const stockColor = (stock: number, minStock = 5): string => {
  if (stock <= 0) return 'badge-red'
  if (stock <= minStock) return 'badge-yellow'
  return 'badge-green'
}

// Sale status badge
export const saleStatusBadge = (status: string): { cls: string; label: string } => {
  switch (status) {
    case 'COMPLETED': return { cls: 'badge-green', label: 'Completada' }
    case 'CANCELLED': return { cls: 'badge-red', label: 'Cancelada' }
    case 'PENDING': return { cls: 'badge-yellow', label: 'Pendiente' }
    default: return { cls: 'badge-gray', label: status }
  }
}

// Invoice status badge
export const invoiceStatusBadge = (status: string): { cls: string; label: string } => {
  switch (status) {
    case 'EMITIDA': return { cls: 'badge-blue', label: 'Emitida' }
    case 'ANULADA': return { cls: 'badge-red', label: 'Anulada' }
    case 'ENVIADA_DIAN': return { cls: 'badge-green', label: 'Enviada DIAN' }
    default: return { cls: 'badge-gray', label: status }
  }
}

// Purchase order status badge
export const poStatusBadge = (status: string): { cls: string; label: string } => {
  switch (status) {
    case 'PENDIENTE': return { cls: 'badge-yellow', label: 'Pendiente' }
    case 'RECIBIDA': return { cls: 'badge-green', label: 'Recibida' }
    case 'CANCELADA': return { cls: 'badge-red', label: 'Cancelada' }
    case 'PARCIAL': return { cls: 'badge-orange', label: 'Parcial' }
    default: return { cls: 'badge-gray', label: status }
  }
}

// ABC class badge
export const abcBadge = (cls: string): string => {
  switch (cls) {
    case 'A': return 'badge-green'
    case 'B': return 'badge-yellow'
    case 'C': return 'badge-red'
    default: return 'badge-gray'
  }
}

// Role label
export const roleLabel = (role: string): string => {
  switch (role) {
    case 'ADMIN': return 'Administrador'
    case 'SELLER': return 'Vendedor'
    case 'WAREHOUSE': return 'Almacén'
    default: return role
  }
}

// Payment method label
export const paymentMethodLabel = (method: string): string => {
  switch (method) {
    case 'EFECTIVO': return 'Efectivo'
    case 'TARJETA_CREDITO': return 'Tarjeta Crédito'
    case 'TARJETA_DEBITO': return 'Tarjeta Débito'
    case 'TRANSFERENCIA_BANCARIA': return 'Transferencia'
    case 'MIXTO': return 'Mixto'
    default: return method
  }
}
