import { z } from 'zod';
import api from '@/services/api';
import type { Ticket, Paginated } from '@/types/crm';
const BASE = '/crm/tickets';
export const createTicketSchema = z.object({ customerId: z.string().min(1, 'Cliente requerido'), subject: z.string().min(3, 'Asunto mínimo 3 caracteres').max(200), description: z.string().min(5, 'Descripción mínimo 5 caracteres').max(2000), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).default('MEDIUM'), assignedTo: z.string().optional() });
export const updateTicketSchema = z.object({ status: z.enum(['OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED']).optional(), priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(), assignedTo: z.string().optional() });
export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
export interface ListTicketParams { customerId?: string; status?: string; priority?: string; page?: number; limit?: number; }
export const ticketService = {
  async list(params: ListTicketParams = {}): Promise<Paginated<Ticket>> { const { data } = await api.get<{ data: Ticket[]; meta: { total: number; page: number; totalPages: number } }>(BASE, { params }); return { data: data.data, total: data.meta.total, page: data.meta.page, totalPages: data.meta.totalPages }; },
  async create(input: CreateTicketInput): Promise<Ticket> { const parsed = createTicketSchema.parse(input); const { data } = await api.post<Ticket>(BASE, parsed); return data; },
  async update(id: string, input: UpdateTicketInput): Promise<Ticket> { const parsed = updateTicketSchema.parse(input); const { data } = await api.patch<Ticket>(`${BASE}/${id}`, parsed); return data; },
};
