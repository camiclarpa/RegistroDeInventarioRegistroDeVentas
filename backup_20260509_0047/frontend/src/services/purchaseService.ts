import axios from 'axios'
import type { PurchaseOrder, Supplier } from '@/types'

const API = '/api/v1'

export interface GetOrdersParams {
  page?: number
  limit?: number
  status?: string
  supplierId?: string
}

export interface PurchaseOrderResponse {
  success: boolean
  data: PurchaseOrder[]
  total: number
  totalPages: number
}

export const purchaseService = {
  async getOrders(params?: GetOrdersParams): Promise<PurchaseOrderResponse> {
    const res = await axios.get(`${API}/purchases/orders`, { params })
    // Backend retorna: { success: true, data: { data: [], total, totalPages } }
    return {
      success: res.data.success,
      data: res.data.data?.data ?? [],  // ✅ Extraer array anidado
      total: res.data.data?.total ?? 0,
      totalPages: res.data.data?.totalPages ?? 1,
    }
  },

  async getSuppliers(): Promise<Supplier[]> {
    const res = await axios.get(`${API}/purchases/suppliers`)
    return res.data.data ?? []
  },

  async createOrder(data: unknown): Promise<PurchaseOrder> {
    const res = await axios.post(`${API}/purchases/orders`, data)
    return res.data.data
  },

  async createSupplier(data: unknown): Promise<Supplier> {
    const res = await axios.post(`${API}/purchases/suppliers`, data)
    return res.data.data
  },

  async receiveOrder(id: string, items: unknown[]): Promise<PurchaseOrder> {
    const res = await axios.post(`${API}/purchases/orders/${id}/receive`, { items })
    return res.data.data
  },

  async cancelOrder(id: string, reason: string): Promise<PurchaseOrder> {
    const res = await axios.post(`${API}/purchases/orders/${id}/cancel`, { reason })
    return res.data.data
  },
}
