export const formatCOP = (amount: number): string => {
  return new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

export const formatDate = (date: string | null): string => {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
};

export const formatDateTime = (date: string | null): string => {
  if (!date) return '—';
  return new Date(date).toLocaleString('es-CO', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatKm = (km: number | null): string => {
  if (!km) return '—';
  return `${km.toLocaleString()} km`;
};

export const RFM_LABELS: Record<string, string> = {
  CHAMPIONS: 'Campeones',
  LOYAL: 'Leales',
  POTENTIAL: 'Potenciales',
  NEW: 'Nuevos',
  AT_RISK: 'En Riesgo',
  HIBERNATING: 'Hibernando',
  LOST: 'Perdidos',
  REGULAR: 'Regular',
};

export const RFM_COLORS: Record<string, string> = {
  CHAMPIONS: 'bg-green-100 text-green-800',
  LOYAL: 'bg-blue-100 text-blue-800',
  POTENTIAL: 'bg-indigo-100 text-indigo-800',
  NEW: 'bg-purple-100 text-purple-800',
  AT_RISK: 'bg-orange-100 text-orange-800',
  HIBERNATING: 'bg-yellow-100 text-yellow-800',
  LOST: 'bg-red-100 text-red-800',
  REGULAR: 'bg-gray-100 text-gray-800',
};

export const RFM_CHART_FILL: Record<string, string> = {
  CHAMPIONS: '#10b981',
  LOYAL: '#3b82f6',
  POTENTIAL: '#6366f1',
  NEW: '#a855f7',
  AT_RISK: '#f97316',
  HIBERNATING: '#eab308',
  LOST: '#ef4444',
  REGULAR: '#6b7280',
};

export const AGING_LABELS: Record<string, string> = {
  CURRENT: 'Al día',
  '1-30': '1-30 días',
  '31-60': '31-60 días',
  '61-90': '61-90 días',
  '90+': 'Más de 90',
};

export const AGING_COLORS: Record<string, string> = {
  CURRENT: '#10b981',
  '1-30': '#3b82f6',
  '31-60': '#f59e0b',
  '61-90': '#f97316',
  '90+': '#ef4444',
};

export const WORKSHOP_SERVICES = [
  { value: 'OIL_CHANGE', label: 'Cambio de aceite' },
  { value: 'BRAKE_SERVICE', label: 'Servicio de frenos' },
  { value: 'TIRE_CHANGE', label: 'Cambio de llantas' },
  { value: 'TUNE_UP', label: 'Afinación' },
  { value: 'ELECTRICAL', label: 'Sistema eléctrico' },
  { value: 'SUSPENSION', label: 'Suspensión' },
  { value: 'ENGINE_REPAIR', label: 'Reparación de motor' },
  { value: 'TRANSMISSION', label: 'Transmisión' },
  { value: 'GENERAL_REVIEW', label: 'Revisión general' },
  { value: 'OTHER', label: 'Otro' },
];

export const REMINDER_TYPES = [
  { value: 'OIL_CHANGE', label: 'Cambio de aceite' },
  { value: 'TECHNICAL_REVIEW', label: 'Revisión técnico-mecánica' },
  { value: 'SOAT_EXPIRY', label: 'Vencimiento SOAT' },
  { value: 'WARRANTY_EXPIRY', label: 'Vencimiento de garantía' },
  { value: 'BIRTHDAY', label: 'Cumpleaños' },
  { value: 'INACTIVE_CUSTOMER', label: 'Cliente inactivo' },
  { value: 'FOLLOW_UP', label: 'Seguimiento' },
  { value: 'PROMOTION', label: 'Promoción' },
  { value: 'OTHER', label: 'Otro' },
];

// ═══════════════════════════════════════════════════════════════
// FORMATTERS ADICIONALES
// ═══════════════════════════════════════════════════════════════
export const formatRelativeTime = (date: string | null): string => {
  if (!date) return '—';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now.getTime() - then.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'ahora';
  if (diffMins < 60) return `hace ${diffMins} min`;
  if (diffHours < 24) return `hace ${diffHours}h`;
  if (diffDays < 7) return `hace ${diffDays}d`;
  return formatDate(date);
};

export const CHANNEL_LABELS: Record<string, string> = {
  WHATSAPP: 'WhatsApp',
  EMAIL: 'Email',
  SMS: 'SMS',
  CALL: 'Llamada',
  IN_PERSON: 'Presencial',
  WEB_CHAT: 'Chat Web',
};

export const CHANNEL_COLORS: Record<string, string> = {
  WHATSAPP: 'bg-green-100 text-green-800',
  EMAIL: 'bg-blue-100 text-blue-800',
  SMS: 'bg-purple-100 text-purple-800',
  CALL: 'bg-orange-100 text-orange-800',
  IN_PERSON: 'bg-indigo-100 text-indigo-800',
  WEB_CHAT: 'bg-pink-100 text-pink-800',
};

export const getRfmBadge = (segment: string): { label: string; className: string } => {
  const label = RFM_LABELS[segment] || segment;
  const className = RFM_COLORS[segment] || 'bg-gray-100 text-gray-800';
  return { label, className };
};

export const QUOTE_STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  SENT: 'bg-blue-100 text-blue-800',
  VIEWED: 'bg-indigo-100 text-indigo-800',
  ACCEPTED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  EXPIRED: 'bg-yellow-100 text-yellow-800',
};

export const STATUS_COLORS: Record<string, string> = {
  OPEN: 'bg-blue-100 text-blue-800',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-800',
  RESOLVED: 'bg-green-100 text-green-800',
  CLOSED: 'bg-gray-100 text-gray-800',
  PENDING: 'bg-blue-100 text-blue-800',
  DONE: 'bg-green-100 text-green-800',
  CANCELLED: 'bg-red-100 text-red-800',
};

export const PRIORITY_COLORS: Record<string, string> = {
  LOW: 'bg-gray-100 text-gray-800',
  MEDIUM: 'bg-blue-100 text-blue-800',
  HIGH: 'bg-orange-100 text-orange-800',
  URGENT: 'bg-red-100 text-red-800',
};
