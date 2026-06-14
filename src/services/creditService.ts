import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

function toFloat(v: unknown): number {
  return parseFloat(String(v ?? 0)) || 0;
}

export interface CreditLimitCheck {
  allowed: boolean;
  message?: string;
  currentDebt: number;
  creditLimit: number | null;
  available: number | null;
}

export async function checkCreditLimit(customerId: string, requestedAmount: number): Promise<CreditLimitCheck> {
  const customer = await prisma.customers.findUnique({
    where: { id: customerId },
    select: { creditLimit: true, name: true },
  });
  if (!customer) throw new Error('Cliente no encontrado');
  if (!customer.creditLimit) {
    return { allowed: true, currentDebt: 0, creditLimit: null, available: null };
  }
  const creditLimit = toFloat(customer.creditLimit);
  const agg = await prisma.accounts_receivable.aggregate({
    where: {
      customerId,
      status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] },
    },
    _sum: { remainingBalance: true },
  });
  const currentDebt = toFloat(agg._sum.remainingBalance);
  const available = creditLimit - currentDebt;
  const projectedDebt = currentDebt + requestedAmount;
  if (projectedDebt > creditLimit) {
    return {
      allowed: false,
      message: `Límite excedido. Deuda: $${currentDebt.toLocaleString('es-CO')}, Disponible: $${available.toLocaleString('es-CO')}`,
      currentDebt,
      creditLimit,
      available,
    };
  }
  return { allowed: true, currentDebt, creditLimit, available };
}

export async function createReceivableFromSale(saleId: string, customerId: string, totalAmount: number, dueDate?: Date) {
  return prisma.accounts_receivable.create({
    data: {
      saleId,
      customerId,
      totalDebt: totalAmount,
      paidAmount: 0,
      remainingBalance: totalAmount,
      dueDate,
      status: 'PENDING',
    } as any,
  });
}

export async function recordPayment(creditId: string, amount: number, paymentMethod: string, userId: string, notes?: string, cashRegisterId?: string) {
  const account = await prisma.accounts_receivable.findUnique({
    where: { id: creditId },
  });
  if (!account) throw new Error('Cuenta por cobrar no encontrada');
  
  const newPaidAmount = toFloat(account.paidAmount) + amount;
  const newRemainingBalance = toFloat(account.totalDebt) - newPaidAmount;
  const newStatus = newRemainingBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';
  
  const updated = await prisma.accounts_receivable.update({
    where: { id: creditId },
    data: {
      paidAmount: newPaidAmount,
      remainingBalance: newRemainingBalance,
      status: newStatus,
    } as any,
  });
  
  logger.info(`[creditService] Pago registrado: ${creditId} - $${amount} - usuario ${userId}`);
  return updated;
}

export async function getCustomerCredits(customerId: string) {
  const credits = await prisma.accounts_receivable.findMany({
    where: { customerId, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    include: {
      sales: { select: { id: true, saleNumber: true, createdAt: true, total: true } },
    },
  });
  
  const summary = credits.reduce((acc, c) => ({
    totalDebt: acc.totalDebt + toFloat(c.totalDebt),
    totalPaid: acc.totalPaid + toFloat(c.paidAmount),
    totalPending: acc.totalPending + toFloat(c.remainingBalance),
    count: credits.length,
  }), { totalDebt: 0, totalPaid: 0, totalPending: 0, count: 0 });
  
  return { credits, summary };
}

export async function updateCreditLimit(customerId: string, newLimit: number | null, userId: string) {
  const customer = await prisma.customers.update({
    where: { id: customerId },
    data: { creditLimit: newLimit } as any,
  });
  
  logger.info(`[creditService] Límite de crédito actualizado: ${customerId} - $${newLimit} - usuario ${userId}`);
  return customer;
}

