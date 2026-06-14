export interface Customer {
  id: string;
  name: string;
  phone: string | null;
  email: string | null;
  identificationNumber: string | null;
  address: string | null;
  isActive: boolean;
  preferences: string | null;
  notes: string | null;
  tags: string[];
  loyaltyPoints: number;
  loyaltyTier: 'BRONZE' | 'SILVER' | 'GOLD' | 'PLATINUM';
  totalSpent: number;
  lastPurchaseAt: string | null;
  purchaseCount: number;
  creditLimit: number | null;
  assigned_user_id: string | null;
  recency_days: number;
  frequency_6m: number;
  monetary_6m: number;
  rfm_segment: string;
  credit_risk_score: number;
  last_communication_at: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Motorcycle {
  id: string;
  plate: string;
  brand: string;
  model: string;
  year: number | null;
  lastKm: number | null;
  customerId: string;
  createdAt: string;
}

export interface Reminder {
  id: string;
  customerId: string;
  type: string;
  message: string;
  dueDate: string;
  isSent: boolean;
  createdAt: string;
}

export interface Sale {
  id: string;
  saleNumber: string;
  totalAmount: number;
  status: string;
  paymentMethod: string;
  createdAt: string;
  motorcycle?: { plate: string; brand: string; model: string } | null;
}

export interface Communication {
  id: string;
  customerId: string;
  customer?: { id: string; name: string; phone?: string | null };
  direction: 'INBOUND' | 'OUTBOUND';
  channel: string;
  message: string;
  status: string;
  isRead: boolean;
  readAt: string | null;
  sentByUserId: string;
  sentByUser?: { id: string; name: string };
  createdAt: string;
}

export interface WorkshopVisit {
  id: string;
  customerId: string;
  motorcycleId: string | null;
  kmReal: number | null;
  services: string[];
  technician: string | null;
  totalCost: number;
  status: string;
  notes: string | null;
  nextServiceKm: number | null;
  nextServiceDate: string | null;
  createdAt: string;
  customer?: { name: string };
  motorcycle?: { plate: string; brand: string; model: string };
}

export interface Warranty {
  id: string;
  customerId: string;
  saleItemId: string;
  productName: string;
  days: number;
  expiresAt: string;
  status: 'ACTIVE' | 'CLAIMED' | 'EXPIRED';
  claimNotes: string | null;
  createdAt: string;
}

export interface CreditRecord {
  id: string;
  saleId: string;
  customerId: string;
  totalDebt: number;
  paidAmount: number;
  remainingBalance: number;
  dueDate: string | null;
  status: string;
  createdAt: string;
  sale?: { id: string; saleNumber: string; createdAt: string; totalAmount: number };
}

export interface CrmKpis {
  totalCustomers: number;
  activeCustomers: number;
  retentionRate: number;
  openTickets: number;
  recentCommunications: number;
  segmentDistribution: Array<{ segment: string; count: number }>;
  agingDistribution: Array<{ bucket: string; amount: number; count: number }>;
}

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  totalPages: number;
}

// ═══════════════════════════════════════════════════════════════
// TIPOS ADICIONALES (Quote, Ticket)
// ═══════════════════════════════════════════════════════════════
export interface Quote {
  id: string;
  customerId: string;
  customer?: { id: string; name: string; phone?: string | null };
  items: QuoteItem[];
  discount: number;
  subtotal?: number;
  total: number;
  status: string;
  expiresAt?: string | null;
  notes?: string | null;
  createdAt: string;
  updatedAt: string;
  deliveries?: QuoteDelivery[];
}

export interface QuoteItem {
  id?: string;
  productId?: string;
  description: string;
  qty: number;
  unitPrice: number;
  discount: number;
  lineTotal?: number;
}

export interface QuoteDelivery {
  id: string;
  quoteId: string;
  channel: string;
  link?: string | null;
  deliveredAt: string;
}

export interface Ticket {
  id: string;
  customerId: string;
  customer?: { id: string; name: string };
  subject: string;
  description: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'RESOLVED' | 'CLOSED';
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  assignedTo?: string | null;
  assignedUser?: { id: string; name: string } | null;
  resolvedAt?: string | null;
  resolvedBy?: string | null;
  createdAt: string;
  updatedAt: string;
}
