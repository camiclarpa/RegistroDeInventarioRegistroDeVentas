import { z } from 'zod';
import api from '@/services/api';
import type { WorkshopVisit, Paginated } from '@/types/crm';
const BASE = '/crm/workshop';
export const createVisitSchema = z.object({ customerId: z.string().min(1, 'Cliente requerido'), motorcycleId: z.string().optional(), kmReal: z.number().int().min(0).optional(), services: z.array(z.string()).min(1, 'Selecciona al menos un servicio'), technician: z.string().optional(), totalCost: z.number().min(0, 'Costo debe ser ≥ 0'), notes: z.string().optional(), nextServiceKm: z.number().int().min(0).optional() });
export type CreateVisitInput = z.infer<typeof createVisitSchema>;
export interface ListVisitParams { customerId?: string; motorcycleId?: string; page?: number; limit?: number; }
export const workshopService = {
  async list(params: ListVisitParams = {}): Promise<Paginated<WorkshopVisit>> { const { data } = await api.get<{ data: WorkshopVisit[]; meta: { total: number; page: number; totalPages: number } }>(BASE, { params }); return { data: data.data, total: data.meta.total, page: data.meta.page, totalPages: data.meta.totalPages }; },
  async create(input: CreateVisitInput): Promise<WorkshopVisit> { const parsed = createVisitSchema.parse(input); const { data } = await api.post<WorkshopVisit>(BASE, parsed); return data; },
  async getHistory(customerId: string): Promise<WorkshopVisit[]> { const result = await workshopService.list({ customerId, limit: 50 }); return result.data; },
};
