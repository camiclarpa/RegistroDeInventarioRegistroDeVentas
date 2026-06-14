import api from '@/services/api';
import type { CrmKpis } from '@/types/crm';
const BASE = '/crm/analytics';
export const analyticsService = {
  async getKpis(): Promise<CrmKpis> { const { data } = await api.get<CrmKpis>(`${BASE}/kpis`); return data; },
  async refreshRfm(customerId: string): Promise<void> { await api.post(`${BASE}/rfm/${customerId}`, {}); },
};
