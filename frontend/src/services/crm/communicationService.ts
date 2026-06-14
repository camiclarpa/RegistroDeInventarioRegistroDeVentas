import { z } from 'zod';
import api from '@/services/api';
import type { Communication, Paginated } from '@/types/crm';
const BASE = '/crm/communications';
export const createCommSchema = z.object({ customerId: z.string().min(1, 'Cliente requerido'), channel: z.enum(['WHATSAPP', 'EMAIL', 'CALL', 'IN_PERSON', 'SMS']), direction: z.enum(['INBOUND', 'OUTBOUND']).default('OUTBOUND'), message: z.string().min(1, 'Mensaje requerido').max(2000), status: z.enum(['SENT', 'DELIVERED', 'READ', 'FAILED', 'PENDING']).optional() });
export type CreateCommInput = z.infer<typeof createCommSchema>;
export interface ListCommParams { customerId?: string; channel?: string; status?: string; page?: number; limit?: number; }
export const communicationService = {
  async list(params: ListCommParams = {}): Promise<Paginated<Communication>> { const { data } = await api.get<{ data: Communication[]; meta: { total: number; page: number; totalPages: number } }>(BASE, { params }); return { data: data.data, total: data.meta.total, page: data.meta.page, totalPages: data.meta.totalPages }; },
  async create(input: CreateCommInput): Promise<Communication> { const parsed = createCommSchema.parse(input); const { data } = await api.post<Communication>(BASE, parsed); return data; },
  async markAsRead(id: string): Promise<Communication> { const { data } = await api.patch<Communication>(`${BASE}/${id}/read`, {}); return data; },
};
