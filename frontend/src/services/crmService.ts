import api from './api';

export type LoyaltyTier = 'BRONZE' | 'SILVER' | 'GOLD';

export interface CustomerSearchResult {
  id:             string;
  name:           string;
  phone:          string | null;
  plate:          string | null;
  loyaltyTier:    LoyaltyTier;
  lastPurchaseAt: string | null;
}

export interface Motorcycle {
  id:         string;
  plate:      string;
  brand:      string;
  model:      string;
  year:       number | null;
  lastKm:     number | null;
  customerId: string;
  createdAt:  string;
}

export interface Warranty {
  id:          string;
  customerId:  string;
  saleItemId:  string;
  productName: string;
  days:        number;
  expiresAt:   string;
  status:      'ACTIVE' | 'CLAIMED' | 'EXPIRED';
  claimNotes:  string | null;
  createdAt:   string;
}

export interface CommunicationLog {
  id:          string;
  customerId:  string;
  type:        string;
  message:     string;
  performedBy: string;
  createdAt:   string;
}

export interface Reminder {
  id:         string;
  customerId: string;
  type:       string;
  message:    string;
  dueDate:    string;
  isSent:     boolean;
  createdAt:  string;
}

export interface CreditRecord {
  id:              string;
  saleId:          string;
  customerId:      string;
  totalDebt:       number;
  paidAmount:      number;
  remainingBalance: number;
  dueDate:         string | null;
  status:          'PENDING' | 'PARTIALLY_PAID' | 'PAID' | 'OVERDUE';
  createdAt:       string;
  sale: { id: string; saleNumber: string; createdAt: string; totalAmount: number };
  payments: Array<{
    id:            string;
    amount:        number;
    paymentMethod: string;
    timestamp:     string;
    note:          string | null;
    referenceDoc:  string | null;
  }>;
}

export interface CrmCustomer {
  id:                   string;
  name:                 string;
  phone:                string | null;
  email:                string | null;
  identificationNumber: string | null;
  address:              string | null;
  isActive:             boolean;
  preferences:          string | null;
  notes:                string | null;
  tags:                 string[];
  loyaltyPoints:        number;
  loyaltyTier:          LoyaltyTier;
  totalSpent:           number;
  lastPurchaseAt:       string | null;
  purchaseCount:        number;
  creditLimit:          number | null;
  createdAt:            string;
  motorcycles:          Motorcycle[];
  logs:                 CommunicationLog[];
  reminders:            Reminder[];
  activeCredits:        CreditRecord[];
  totalPendingDebt:     number;
  activeWarranties:     Warranty[];
  recentSales:          Array<{
    id: string; saleNumber: string; totalAmount: number;
    paymentMethod: string; createdAt: string;
    motorcycle: { plate: string; brand: string; model: string } | null;
  }>;
}

export interface CrmCustomerListItem {
  id:             string;
  name:           string;
  phone:          string | null;
  email:          string | null;
  loyaltyTier:    LoyaltyTier;
  loyaltyPoints:  number;
  totalSpent:     number;
  lastPurchaseAt: string | null;
  purchaseCount:  number;
  creditLimit:    number | null;
  createdAt:      string;
  motorcycles:    Array<{ plate: string; brand: string; model: string }>;
}

export interface CreditLimitCheck {
  allowed:     boolean;
  message?:    string;
  currentDebt: number;
  creditLimit: number | null;
  available:   number | null;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: { total: number; page: number; limit: number; totalPages: number };
}

export const crmService = {
  async search(query: string): Promise<CustomerSearchResult[]> {
    const res = await api.get('/crm/customers/search', { params: { q: query } });
    return res.data;
  },
  async list(params: { page?: number; limit?: number; tier?: string; search?: string; }): Promise<PaginatedResponse<CrmCustomerListItem>> {
    const res = await api.get('/crm/customers', { params });
    return res.data;
  },
  async getDetail(id: string): Promise<CrmCustomer> {
    const res = await api.get(`/crm/customers/${id}`);
    return res.data;
  },
  async create(data: { name: string; phone?: string; email?: string; identificationNumber?: string; address?: string; notes?: string; preferences?: string; tags?: string[]; creditLimit?: number; }): Promise<CrmCustomer> {
    const res = await api.post('/crm/customers', data);
    return res.data;
  },
  async update(id: string, data: Partial<{ name: string; phone: string; email: string; identificationNumber: string; address: string; notes: string; preferences: string; tags: string[]; creditLimit: number; }>): Promise<CrmCustomer> {
    const res = await api.patch(`/crm/customers/${id}`, data);
    return res.data;
  },
  async setCreditLimit(id: string, limit: number | null): Promise<void> {
    await api.patch(`/crm/customers/${id}/credit-limit`, { limit });
  },
  async addMotorcycle(customerId: string, data: { plate: string; brand: string; model: string; year?: number; lastKm?: number; }): Promise<Motorcycle> {
    const res = await api.post(`/crm/customers/${customerId}/motorcycles`, data);
    return res.data;
  },
  async updateMotorcycle(id: string, data: Partial<{ brand: string; model: string; year: number; lastKm: number; }>): Promise<Motorcycle> {
    const res = await api.patch(`/crm/motorcycles/${id}`, data);
    return res.data;
  },
  async getWarranties(customerId: string, status: 'active' | 'all' = 'active'): Promise<Warranty[]> {
    const res = await api.get(`/crm/customers/${customerId}/warranties`, { params: { status } });
    return res.data;
  },
  async claimWarranty(warrantyId: string, notes: string): Promise<Warranty> {
    const res = await api.patch(`/crm/warranties/${warrantyId}/claim`, { notes });
    return res.data;
  },
  async getCredits(customerId: string): Promise<{ credits: CreditRecord[]; summary: any }> {
    const res = await api.get(`/crm/customers/${customerId}/credits`);
    return res.data;
  },
  async checkCreditLimit(customerId: string, amount: number): Promise<CreditLimitCheck> {
    const res = await api.get(`/crm/customers/${customerId}/check-limit`, { params: { amount } });
    return res.data;
  },
  async createCredit(data: { saleId: string; customerId: string; totalAmount: number; dueDate: string; }): Promise<CreditRecord> {
    const res = await api.post('/crm/credits', data);
    return res.data;
  },
  async payCredit(creditId: string, data: { amount: number; paymentMethod: string; notes?: string; cashRegisterId?: string; }): Promise<any> {
    const res = await api.patch(`/crm/credits/${creditId}/pay`, data);
    return res.data;
  },
  async addLog(data: { customerId: string; type: string; message: string; }): Promise<CommunicationLog> {
    const res = await api.post('/crm/communication', data);
    return res.data;
  },
  async addReminder(customerId: string, data: { type: string; message: string; dueDate: string; }): Promise<Reminder> {
    const res = await api.post(`/crm/customers/${customerId}/reminders`, data);
    return res.data;
  },
  async addLoyaltyPoints(customerId: string, amount: number): Promise<{ pointsEarned: number; totalPoints: number; newTier: LoyaltyTier; tierChanged: boolean; }> {
    const res = await api.post(`/crm/customers/${customerId}/loyalty`, { amount });
    return res.data;
  },
};

export default crmService;

// ═══════════════════════════════════════════════════════════════
// CHAT WEB
// ═══════════════════════════════════════════════════════════════
export interface ChatMessage {
  id: string;
  customer_id: string;
  direction: 'INBOUND' | 'OUTBOUND';
  channel: string;
  message: string;
  status: string;
  is_read: boolean;
  read_at: string | null;
  sent_by_user_id: string;
  sent_by_user?: {
    id: string;
    name: string;
    email: string;
  };
  created_at: string;
}

export interface ChatResponse {
  data: ChatMessage[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  };
}

export const chatService = {
  async getMessages(customerId: string, page = 1, limit = 50): Promise<ChatResponse> {
    const res = await api.get(`/crm/chat/${customerId}`, { params: { page, limit } });
    return res.data;
  },

  async sendMessage(customerId: string, message: string): Promise<ChatMessage> {
    const res = await api.post(`/crm/chat/${customerId}`, { message });
    return res.data;
  },

  async markAsRead(messageId: string): Promise<ChatMessage> {
    const res = await api.patch(`/crm/chat/${messageId}/read`);
    return res.data;
  },

  async getUnreadCount(customerId: string): Promise<{ count: number }> {
    const res = await api.get(`/crm/chat/${customerId}/unread`);
    return res.data;
  },
};
