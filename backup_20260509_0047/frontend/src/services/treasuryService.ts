import api from './api'
import type { CashRegister, TreasuryTransaction, PaymentMethod } from '@/types'

// Interfaces locales (extensiones de los tipos globales si es necesario)
export interface TreasuryStats {
  initialBalance: number
  salesToday: number
  expensesToday: number
  expectedBalance: number
  cashRegisterStatus: string
}

// Helper para convertir strings a numbers
const parseAmount = (val: string | number | null | undefined): number => {
  if (val === null || val === undefined) return 0
  return typeof val === 'number' ? val : parseFloat(val) || 0
}

export const treasuryService = {
  async getCashRegister(): Promise<CashRegister | null> {
    try {
      const res = await api.get('/treasury/cash-register/current')
      if (!res.data.success || !res.data.data) return null
      const data = res.data.data
      return {
        ...data,
        openingBalance: parseAmount(data.openingBalance),
        closingBalance: parseAmount(data.closingBalance),
        expectedBalance: parseAmount(data.expectedClosingBalance),
        difference: parseAmount(data.difference),
        transactions: (data.transactions ?? []).map((t: any) => ({
          ...t,
          amount: parseAmount(t.amount),
          concept: t.description,
          createdAt: t.timestamp,
          paymentMethod: t.paymentMethod as PaymentMethod // Cast al tipo estricto
        }))
      }
    } catch {
      return null
    }
  },

  async getTransactions(params?: { limit?: number; offset?: number }): Promise<TreasuryTransaction[]> {
    try {
      const res = await api.get('/treasury/transactions', { params })
      if (!res.data.success) return []
      let transactions = res.data.data ?? []
      if (Array.isArray(transactions?.data)) transactions = transactions.data
      return transactions.map((t: any) => ({
        ...t,
        amount: parseAmount(t.amount),
        concept: t.description ?? t.concept,
        createdAt: t.timestamp ?? t.createdAt,
        paymentMethod: t.paymentMethod as PaymentMethod // Cast al tipo estricto
      }))
    } catch {
      return []
    }
  },

  async getStats(): Promise<TreasuryStats> {
    try {
      const res = await api.get('/treasury/stats')
      if (!res.data.success) {
        return { initialBalance: 0, salesToday: 0, expensesToday: 0, expectedBalance: 0, cashRegisterStatus: 'UNKNOWN' }
      }
      const data = res.data.data
      return {
        initialBalance: parseAmount(data.initialBalance),
        salesToday: parseAmount(data.salesToday),
        expensesToday: parseAmount(data.expensesToday),
        expectedBalance: parseAmount(data.expectedBalance),
        cashRegisterStatus: data.cashRegisterStatus ?? 'UNKNOWN'
      }
    } catch {
      return { initialBalance: 0, salesToday: 0, expensesToday: 0, expectedBalance: 0, cashRegisterStatus: 'UNKNOWN' }
    }
  },

  async openCashRegister(openingAmount: number, notes?: string) {
    const res = await api.post('/treasury/open', { initialBalance: openingAmount.toString(), notes })
    return res.data.data
  },

  async closeCashRegister(closingAmount: number, notes?: string) {
    const res = await api.post('/treasury/close', { closingBalance: closingAmount.toString(), notes })
    return res.data.data
  },

  async registerExpense(amount: number, description: string, category: string, paymentMethod: PaymentMethod) {
    const res = await api.post('/treasury/expenses', { amount: amount.toString(), description, category, paymentMethod })
    return res.data.data
  },

  async registerIncome(amount: number, description: string, paymentMethod: PaymentMethod) {
    const res = await api.post('/treasury/income', { amount: amount.toString(), description, paymentMethod })
    return res.data.data
  },

  // Aliases para compatibilidad con componente
  getCurrentRegister() {
    return this.getCashRegister()
  },

  getDailyReport(): Promise<{ openingBalance: number; totalSales: number; totalExpenses: number; closingBalance: number } | null> {
    return this.getStats().then(stats => ({
      openingBalance: stats.initialBalance,
      totalSales: stats.salesToday,
      totalExpenses: stats.expensesToday,
      closingBalance: stats.expectedBalance
    })).catch(() => null)
  },

  openRegister(data: { openingBalance: number; notes?: string }) {
    return this.openCashRegister(data.openingBalance, data.notes)
  },

  closeRegister(cashRegisterId: string, data: { actualBalance: number; notes?: string }) {
    return this.closeCashRegister(data.actualBalance, data.notes)
  },

  createExpense(data: { amount: number; concept: string; category: string; paymentMethod: PaymentMethod; cashRegisterId?: string }) {
    return this.registerExpense(data.amount, data.concept, data.category, data.paymentMethod)
  },

  createIncome(data: { amount: number; description: string; paymentMethod: PaymentMethod }) {
    return this.registerIncome(data.amount, data.description, data.paymentMethod)
  }
}
