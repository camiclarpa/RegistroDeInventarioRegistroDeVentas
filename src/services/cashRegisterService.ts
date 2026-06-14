import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

function toFloat(value: unknown): number {
  return parseFloat(String(value ?? 0)) || 0;
}

export async function openCashRegister(
  userId: string,
  openingBalance: number,
  notes?: string,
) {
  const existing = await prisma.cash_registers.findFirst({
    where: { status: 'OPEN' },
    select: { id: true, openedAt: true, openedByUserId: true },
  });

  if (existing) {
    throw new Error(
      `Ya hay una caja abierta (ID: ${existing.id}). Ciérrala antes de abrir una nueva.`,
    );
  }

  const register = await prisma.cash_registers.create({
    data: {
      openedByUserId: userId,
      initialBalance: openingBalance,
      status: 'OPEN',
      openedAt: new Date(),
      notes,
    } as any,
  });

  logger.info(`[cashRegisterService] Caja abierta: ${register.id} — $${openingBalance}`);
  return register;
}

export async function closeCashRegister(
  cashRegisterId: string,
  closingBalance: number,
  userId: string,
  notes?: string,
) {
  const register = await prisma.cash_registers.findUnique({
    where: { id: cashRegisterId },
    select: { id: true, status: true, initialBalance: true, notes: true },
  });

  if (!register) throw new Error('Caja no encontrada');
  if (register.status === 'CLOSED') {
    throw new Error('Esta caja ya fue cerrada');
  }

  const [incomeAgg, expenseAgg] = await Promise.all([
    prisma.financial_transactions.aggregate({
      where: { cashRegisterId, type: 'INCOME' },
      _sum: { amount: true },
    }),
    prisma.financial_transactions.aggregate({
      where: { cashRegisterId, type: { in: ['EXPENSE', 'WITHDRAWAL', 'DEPOSIT', 'PAYMENT_MADE'] } },
      _sum: { amount: true },
    }),
  ]);

  const totalIncome = toFloat(incomeAgg._sum.amount);
  const totalExpense = toFloat(expenseAgg._sum.amount);
  const initialBalance = toFloat(register.initialBalance);
  const expectedBalance = initialBalance + totalIncome - totalExpense;
  const difference = closingBalance - expectedBalance;

  const closed = await prisma.cash_registers.update({
    where: { id: cashRegisterId },
    data: {
      closedByUserId: userId,
      currentBalance: closingBalance,
      expectedClosingBalance: expectedBalance,
      difference: difference,
      status: 'CLOSED',
      closedAt: new Date(),
      notes: notes ?? register.notes,
    } as any,
  });

  logger.info(`[cashRegisterService] Caja cerrada: ${cashRegisterId} — diferencia: $${difference}`);

  return {
    ...closed,
    summary: {
      openingBalance: initialBalance,
      totalIncome: parseFloat(totalIncome.toFixed(2)),
      totalExpense: parseFloat(totalExpense.toFixed(2)),
      expectedClosingBalance: parseFloat(expectedBalance.toFixed(2)),
      closingBalance: closingBalance,
      difference: parseFloat(difference.toFixed(2)),
      differenceStatus: difference === 0 ? 'EXACT' : difference > 0 ? 'SURPLUS' : 'SHORTAGE',
    },
  };
}

export async function getCurrentOpenRegister() {
  const register = await prisma.cash_registers.findFirst({
    where: { status: 'OPEN' },
  });
  return register;
}

export async function getCashRegisterSummary(cashRegisterId: string) {
  const register = await prisma.cash_registers.findUnique({
    where: { id: cashRegisterId },
  });

  if (!register) throw new Error('Caja no encontrada');

  const byType = await prisma.financial_transactions.groupBy({
    by: ['type'],
    where: { cashRegisterId },
    _sum: { amount: true },
    _count: { id: true },
  });

  const transactions = await prisma.financial_transactions.findMany({
    where: { cashRegisterId },
    orderBy: { timestamp: 'desc' },
    take: 20,
  });

  return {
    register,
    breakdown: byType.map((r) => ({
      type: r.type,
      total: toFloat(r._sum.amount),
      count: r._count.id,
    })),
    recentTransactions: transactions,
  };
}

export async function listCashRegisters(limit = 20) {
  return prisma.cash_registers.findMany({
    orderBy: { openedAt: 'desc' },
    take: limit,
  });
}

