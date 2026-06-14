import api from './api'
import type { DashboardData } from '@/types'

export const reportService = {
  async getDashboard(): Promise<DashboardData> {
    const res = await api.get('/reports/dashboard')
    return res.data?.data ?? res.data
  },

  async getDashboardStats() {
    const res = await api.get('/reports/dashboard/stats')
    return res.data?.data ?? res.data
  },

  async getRecentSales(limit: number = 10) {
    const res = await api.get(`/reports/dashboard/recent-sales?limit=${limit}`)
    return res.data?.data ?? res.data
  },

  async getStockAlerts() {
    const res = await api.get('/reports/dashboard/stock-alerts')
    return res.data?.data ?? res.data
  },

  async getSalesTrend() {
    const res = await api.get('/reports/dashboard/sales-trend')
    return res.data?.data ?? res.data
  },

  async getCategorySales() {
    const res = await api.get('/reports/dashboard/category-sales')
    return res.data?.data ?? res.data
  },

  async getAbcAnalysis(params?: any) {
    const res = await api.get('/reports/abc-analysis', { params })
    return res.data?.data ?? res.data
  },

  async getInventoryValuation() {
    const res = await api.get('/reports/inventory/valuation')
    return res.data?.data ?? res.data
  },

  async getProductRotation(params?: any) {
    const res = await api.get('/reports/products/rotation', { params })
    return res.data?.data ?? res.data
  },

  async getProfitability(params?: any) {
    const res = await api.get('/reports/profitability', { params })
    return res.data?.data ?? res.data
  },

  async getInventoryAging() {
    const res = await api.get('/reports/inventory/aging')
    return res.data?.data ?? res.data
  },

  async getSalesGrouped(params?: any) {
    const res = await api.get('/reports/sales/grouped', { params })
    return res.data?.data ?? res.data
  },

  async getTopCustomers() {
    const res = await api.get('/reports/customers/top-buyers')
    return res.data?.data ?? res.data
  },

  async getSupplierPerformance() {
    const res = await api.get('/reports/suppliers/performance')
    return res.data?.data ?? res.data
  },

  async getExecutiveDashboard() {
    const res = await api.get('/reports/dashboard/executive')
    return res.data?.data ?? res.data
  },

  async getProductRotationAnalysis(params?: any) {
    const res = await api.get('/reports/products/rotation', { params })
    return res.data?.data ?? res.data
  },

  async getLowStockAlerts() {
    const res = await api.get('/reports/alerts/low-stock')
    return res.data?.data ?? res.data
  },

  async exportReport(type: string, params?: any) {
    const res = await api.get(`/reports/export/${type}`, { params })
    return res.data?.data ?? res.data
  }
}
