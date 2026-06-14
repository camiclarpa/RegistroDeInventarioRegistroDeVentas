import { z } from 'zod';
import api from '@/services/api';
import type { Quote, QuoteDelivery, Paginated } from '@/types/crm';
const BASE = '/crm/quotes';
const quoteItemSchema = z.object({ productId: z.string().optional(), description: z.string().min(1, 'Descripción requerida'), qty: z.number().int().positive('Cantidad debe ser positiva'), unitPrice: z.number().min(0, 'Precio debe ser ≥ 0'), discount: z.number().min(0).max(100).default(0) });
export const createQuoteSchema = z.object({ customerId: z.string().min(1, 'Cliente requerido'), items: z.array(quoteItemSchema).min(1, 'Agrega al menos un ítem'), discount: z.number().min(0).max(100).default(0), expiresAt: z.string().optional(), notes: z.string().optional() });
export type CreateQuoteInput = z.infer<typeof createQuoteSchema>;
export interface ListQuoteParams { customerId?: string; status?: string; page?: number; limit?: number; }
export const quoteService = {
  async list(params: ListQuoteParams = {}): Promise<Paginated<Quote>> { const { data } = await api.get<{ data: Quote[]; meta: { total: number; page: number; totalPages: number } }>(BASE, { params }); return { data: data.data, total: data.meta.total, page: data.meta.page, totalPages: data.meta.totalPages }; },
  async getById(id: string): Promise<Quote> { const { data } = await api.get<Quote>(`${BASE}/${id}`); return data; },
  async create(input: CreateQuoteInput): Promise<Quote> { const parsed = createQuoteSchema.parse(input); const { data } = await api.post<Quote>(BASE, parsed); return data; },
  async updateStatus(id: string, status: string): Promise<Quote> { const { data } = await api.patch<Quote>(`${BASE}/${id}/status`, { status }); return data; },
  async recordDelivery(id: string, channel: string, link?: string): Promise<QuoteDelivery> { const { data } = await api.post<QuoteDelivery>(`${BASE}/${id}/delivery`, { channel, link }); return data; },
  async getWhatsAppLink(id: string, phone: string): Promise<string> { const { data } = await api.get<{ link: string }>(`${BASE}/${id}/whatsapp`, { params: { phone } }); return data.link; },
  getPdfUrl(id: string): string { return `${api.defaults.baseURL}${BASE}/${id}/pdf`; },
  downloadPdf(id: string): void { const token = localStorage.getItem('auth_token') ?? ''; const url = `${api.defaults.baseURL}${BASE}/${id}/pdf`; fetch(url, { headers: { Authorization: `Bearer ${token}` } }).then(r => r.blob()).then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `cotizacion-${id.slice(-8)}.pdf`; a.click(); URL.revokeObjectURL(a.href); }).catch(() => {}); },
};
