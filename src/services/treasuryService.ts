import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export interface ExpenseInput {
  amount: number;
  description: string;
  category: string;
  paymentMethod: string;
}

export async function getActiveCashRegister(userId: string) {
  return prisma.cash_registers.findFirst({
    where: { openedByUserId: userId, status: 'OPEN' },
    orderBy: { openedAt: 'desc' },
  });
}

export async function openCashRegister(userId: string, initialBalance: number, notes?: string) {
  return prisma.cash_registers.create({
    data: {
      openedByUserId: userId,
      openingBalance: initialBalance,
      status: 'OPEN',
      openedAt: new Date(),
      notes,
    } as any,
  });
}

export async function closeCashRegister(id: string, userId: string, notes?: string) {
  return prisma.cash_registers.update({
    where: { id },
    data: {
      status: 'CLOSED',
      closedAt: new Date(),
      closedByUserId: userId,
      notes,
    } as any,
  });
}

export async function createExpense(data: ExpenseInput & { cashRegisterId: string; userId: string }) {
  return prisma.financial_transactions.create({
    data: {
      cashRegisterId: data.cashRegisterId,
      type: 'EXPENSE',
      amount: data.amount,
      description: data.description,
      category: data.category,
      paymentMethod: data.paymentMethod,
      performedByUserId: data.userId,
    } as any,
  });
}

export async function getDailySummary(cashRegisterId: string, date: Date) {
  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const sales = await prisma.sales.aggregate({
    where: {
      cashRegisterId,
      createdAt: { gte: startOfDay, lte: endOfDay },
      status: 'COMPLETED',
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  const expenses = await prisma.financial_transactions.aggregate({
    where: {
      cashRegisterId,
      type: 'EXPENSE',
      timestamp: { gte: startOfDay, lte: endOfDay },
    },
    _sum: { amount: true },
  });

  return {
    totalSales: Number(sales._sum.totalAmount || 0),
    salesCount: sales._count,
    totalExpenses: Number(expenses._sum.amount || 0),
    netCash: Number(sales._sum.totalAmount || 0) - Number(expenses._sum.amount || 0),
  };
}

export async function getTheoreticalBalance(cashRegisterId: string) {
  const register = await prisma.cash_registers.findUnique({
    where: { id: cashRegisterId },
  });

  if (!register) {
    throw new Error('Cash register not found');
  }

  const sales = await prisma.sales.aggregate({
    where: {
      cashRegisterId,
      status: 'COMPLETED',
      createdAt: { gte: register.openedAt as Date },
    },
    _sum: { totalAmount: true },
  });

  const expenses = await prisma.financial_transactions.aggregate({
    where: {
      cashRegisterId,
      type: 'EXPENSE',
      timestamp: { gte: register.openedAt as Date },
    },
    _sum: { amount: true },
  });

  return {
    initialBalance: Number(register.openingBalance),
    totalSales: Number(sales._sum.totalAmount || 0),
    totalExpenses: Number(expenses._sum.amount || 0),
    theoreticalBalance: Number(register.openingBalance) + Number(sales._sum.totalAmount || 0) - Number(expenses._sum.amount || 0),
  };
}

export async function getCashRegisterById(id: string) {
  return prisma.cash_registers.findUnique({
    where: { id },
  });
}

export async function getAllCashRegisters() {
  return prisma.cash_registers.findMany({
    orderBy: { openedAt: 'desc' },
  });
}

export async function getExpensesByDateRange(startDate: Date, endDate: Date) {
  return prisma.financial_transactions.findMany({
    where: {
      type: 'EXPENSE',
      timestamp: { gte: startDate, lte: endDate },
    },
  });
}

export async function getCashRegisterWithTransactions(id: string) {
  return prisma.cash_registers.findUnique({
    where: { id },
    include: {
      financial_transactions: true,
    },
  });
}

export async function getDailyShiftSummary(userId: string, date?: string) {
  const targetDate = date ? new Date(date) : new Date();
  const startOfDay = new Date(targetDate);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(targetDate);
  endOfDay.setHours(23, 59, 59, 999);

  const register = await prisma.cash_registers.findFirst({
    where: {
      openedByUserId: userId,
      openedAt: { gte: startOfDay, lte: endOfDay },
    },
  });

  if (!register) {
    return null;
  }

  const sales = await prisma.sales.aggregate({
    where: {
      cashRegisterId: register.id,
      status: 'COMPLETED',
      createdAt: { gte: startOfDay, lte: endOfDay },
    },
    _sum: { totalAmount: true },
    _count: true,
  });

  const expenses = await prisma.financial_transactions.aggregate({
    where: {
      cashRegisterId: register.id,
      type: 'EXPENSE',
      timestamp: { gte: startOfDay, lte: endOfDay },
    },
    _sum: { amount: true },
  });

  return {
    cashRegister: {
      id: register.id,
      openedAt: register.openedAt,
      openingBalance: Number(register.openingBalance),
      status: register.status,
    },
    sales: {
      total: Number(sales._sum.totalAmount || 0),
      count: sales._count,
    },
    expenses: {
      total: Number(expenses._sum.amount || 0),
    },
    netCash: Number(sales._sum.totalAmount || 0) - Number(expenses._sum.amount || 0),
  };
}

