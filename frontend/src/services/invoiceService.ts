import api from './api'
import type { Invoice, PaginatedResponse } from '@/types'

export interface InvoiceFilters {
  page?: number
  limit?: number
  startDate?: string
  endDate?: string
  customerId?: string
  status?: string
  customerName?: string
  customerIdentification?: string
}

export const invoiceService = {
  getInvoices: async (filters: InvoiceFilters = {}): Promise<PaginatedResponse<Invoice>> => {
    const { data } = await api.get('/invoices', { params: filters })
    if (Array.isArray(data)) return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 }
    const payload = (data as any)?.data ?? data
    if (Array.isArray(payload)) return { data: payload, total: payload.length, page: 1, limit: payload.length, totalPages: 1 }
    if ((payload as any).invoices) {
      const invoices = Array.isArray((payload as any).invoices) ? (payload as any).invoices : []
      return { data: invoices, total: (payload as any).total ?? invoices.length, page: (payload as any).page ?? 1, limit: (payload as any).limit ?? 20, totalPages: (payload as any).totalPages ?? 1 }
    }
    return { data: [], total: 0, page: 1, limit: 20, totalPages: 0 }
  },

  getInvoice: async (id: string): Promise<Invoice> => {
    console.log("🔍 Intentando obtener factura:", id)
    try {
      const { data } = await api.get(`/invoices/${id}`)
      console.log("📦 Respuesta del backend:", data)
      return data.data ?? data
    } catch (error) {
      console.error("❌ Error obteniendo factura:", error)
      throw error
    }
  },

  cancelInvoice: async (id: string, reason: string): Promise<Invoice> => {
    const { data } = await api.post(`/invoices/${id}/cancel`, { reason })
    return data.data ?? data
  },

  sendToDian: async (id: string): Promise<Invoice> => {
    const { data } = await api.post(`/invoices/${id}/send-dian`)
    return data.data ?? data
  },

  downloadXml: async (id: string): Promise<Blob> => {
    const { data } = await api.get(`/invoices/${id}/xml`, { responseType: 'blob' })
    return data
  },
}
