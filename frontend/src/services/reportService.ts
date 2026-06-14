import api from './api'
import type {
  AbcResponse, InventoryValuation, ProfitabilityData, DashboardData,
} from '@/types'

export interface ReportParams {
  startDate?: string
  endDate?: string
  categoryId?: string
}

export const reportService = {
  getDashboard: async (): Promise<DashboardData> => {
    try {
      const { data } = await api.get('/reports/dashboard')
      return (data as any)?.data ?? data
    } catch {
      return {
      kpis: { salesToday: 0, salesMonth: 0, salesMonthTotal: 0, expensesMonth: 0, lowStockCount: 0, pendingInvoices: 0 },
        salesTrend: [], categorySales: [], recentSales: [], lowStockProducts: []
      }
    }
  },

  // Curva ABC — endpoint real: /reports/products/rotation
  getAbcAnalysis: async (params?: ReportParams): Promise<AbcResponse> => {
    const { data } = await api.get('/reports/products/rotation', { params })
    return (data as any)?.data ?? data
  },

  // Valorización — endpoint real: /reports/inventory/valuation
  getInventoryValuation: async (): Promise<InventoryValuation> => {
    const { data } = await api.get('/reports/inventory/valuation')
    return (data as any)?.data ?? data
  },

  // Rotación de productos — reutiliza el endpoint de rotación ABC
  getProductRotation: async (params?: ReportParams): Promise<AbcResponse> => {
    const { data } = await api.get('/reports/products/rotation', { params })
    return (data as any)?.data ?? data
  },

  // Rentabilidad — endpoint real: /reports/profitability
  getProfitability: async (params?: ReportParams): Promise<ProfitabilityData> => {
    const { data } = await api.get('/reports/profitability', { params })
    return (data as any)?.data ?? data
  },
}
