import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

// ============================================
// HELPERS
// ============================================

function toNumber(value: unknown): number {
  return typeof value === 'number' ? value : parseFloat(String(value ?? 0)) || 0;
}

function resolveAccountStatus(paidAmount: number, totalDebt: number, dueDate?: Date | null): string {
  if (paidAmount >= totalDebt) return 'PAID';
  if (paidAmount > 0) return 'PARTIALLY_PAID';
  if (dueDate && dueDate < new Date()) return 'OVERDUE';
  return 'PENDING';
}

// ============================================
// CUENTAS POR COBRAR (ACCOUNTS RECEIVABLE)
// ============================================

export async function createReceivableFromSale(
  saleId: string,
  customerId: string,
  totalAmount: number,
  dueDate?: Date,
) {
  logger.info('[debtService] createReceivableFromSale', { saleId, customerId, totalAmount });

  const existing = await prisma.accounts_receivable.findUnique({
    where: { saleId } as any,
  });

  if (existing) return existing;

  const receivable = await prisma.accounts_receivable.create({
    data: {
      saleId,
      customerId,
      originalAmount: totalAmount,
      paidAmount: 0,
      remainingBalance: totalAmount,
      dueDate,
      status: 'PENDING',
    } as any,
    include: {
      customers: { select: { id: true, name: true, phone: true } },
      sales: { select: { id: true, saleNumber: true } },
    },
  });

  logger.info(`[debtService] CxC creada: ${receivable.id} — $${totalAmount} cliente ${customerId}`);
  return receivable;
}

export async function getAccountReceivableById(id: string) {
  return prisma.accounts_receivable.findUnique({
    where: { id },
    include: {
      customers: { select: { id: true, name: true, phone: true } },
      sales: { select: { id: true, saleNumber: true, totalAmount: true } },
      payment_records: true,
    },
  });
}

export async function getAccountReceivablesByCustomer(customerId: string) {
  return prisma.accounts_receivable.findMany({
    where: { customerId, status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
    orderBy: { dueDate: 'asc' },
    include: {
      sales: { select: { id: true, saleNumber: true } },
    },
  });
}

export async function listAccountReceivables(filters: {
  customerId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: any = {};
  if (filters.customerId) where.customerId = filters.customerId;
  if (filters.status) where.status = filters.status;
  if (filters.startDate) where.createdAt = { gte: filters.startDate };
  if (filters.endDate) where.createdAt = { lte: filters.endDate };

  const [data, total] = await prisma.$transaction([
    prisma.accounts_receivable.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        customers: { select: { id: true, name: true, phone: true } },
        sales: { select: { id: true, saleNumber: true } },
      },
    }),
    prisma.accounts_receivable.count({ where }),
  ]);

  return { data, total };
}

export async function getOverdueAccountsReceivable() {
  const today = new Date();
  return prisma.accounts_receivable.findMany({
    where: {
      status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      dueDate: { lt: today },
      remainingBalance: { gt: 0 },
    },
    include: {
      customers: { select: { id: true, name: true, phone: true, email: true } },
      sales: { select: { id: true, saleNumber: true } },
    },
    orderBy: { dueDate: 'asc' },
  });
}

export async function registerPaymentToReceivable(
  accountReceivableId: string,
  amount: number,
  paymentMethod: string,
  userId: string,
  reference?: string,
) {
  logger.info('[debtService] registerPaymentToReceivable', { accountReceivableId, amount });

  return prisma.$transaction(async (tx) => {
    const account = await tx.accounts_receivable.findUnique({
      where: { id: accountReceivableId },
    });

    if (!account) {
      throw new Error('Cuenta por cobrar no encontrada');
    }

    const newPaidAmount = toNumber(account.paidAmount) + amount;
    const remainingBalance = toNumber(account.totalDebt) - newPaidAmount;
    const newStatus = remainingBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await tx.accounts_receivable.update({
      where: { id: accountReceivableId },
      data: {
        paidAmount: newPaidAmount,
        remainingBalance: remainingBalance > 0 ? remainingBalance : 0,
        status: newStatus,
      },
    });

    const payment = await tx.payment_records.create({
      data: {
        accountReceivableId,
        amount,
        paymentMethod,
        reference,
        performedByUserId: userId,
      } as any,
    });

    return payment;
  });
}

export async function getCustomerDebtSummary(customerId: string) {
  const accounts = await prisma.accounts_receivable.findMany({
    where: {
      customerId,
      status: { in: ['PENDING', 'PARTIALLY_PAID'] },
      remainingBalance: { gt: 0 },
    },
  });

  const totalDebt = accounts.reduce((sum, acc) => sum + toNumber(acc.remainingBalance), 0);
  const overdueAccounts = accounts.filter(acc => {
    if (!acc.dueDate) return false;
    return new Date(acc.dueDate) < new Date();
  });
  const totalOverdue = overdueAccounts.reduce((sum, acc) => sum + toNumber(acc.remainingBalance), 0);

  return {
    totalDebt,
    totalOverdue,
    accountCount: accounts.length,
    overdueCount: overdueAccounts.length,
    accounts,
  };
}

// ============================================
// CUENTAS POR PAGAR (ACCOUNTS PAYABLE)
// ============================================

export async function createPayableFromPurchase(
  purchaseOrderId: string,
  supplierId: string,
  totalAmount: number,
  dueDate?: Date,
) {
  logger.info('[debtService] createPayableFromPurchase', { purchaseOrderId, supplierId, totalAmount });

  const existing = await prisma.accounts_payable.findUnique({
    where: { purchaseOrderId } as any,
  });

  if (existing) return existing;

  const payable = await prisma.accounts_payable.create({
    data: {
      purchaseOrderId,
      supplierId,
      originalAmount: totalAmount,
      paidAmount: 0,
      remainingBalance: totalAmount,
      dueDate,
      status: 'PENDING',
    } as any,
    include: {
      suppliers: { select: { id: true, name: true, contact: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
    },
  });

  logger.info(`[debtService] CxP creada: ${payable.id} — $${totalAmount} proveedor ${supplierId}`);
  return payable;
}

export async function getAccountPayableById(id: string) {
  return prisma.accounts_payable.findUnique({
    where: { id },
    include: {
      suppliers: { select: { id: true, name: true, contact: true } },
      purchaseOrder: { select: { id: true, orderNumber: true } },
      payment_records: true,
    },
  });
}

export async function listAccountPayables(filters: {
  supplierId?: string;
  status?: string;
  startDate?: Date;
  endDate?: Date;
}) {
  const where: any = {};
  if (filters.supplierId) where.supplierId = filters.supplierId;
  if (filters.status) where.status = filters.status;
  if (filters.startDate) where.createdAt = { gte: filters.startDate };
  if (filters.endDate) where.createdAt = { lte: filters.endDate };

  const [data, total] = await prisma.$transaction([
    prisma.accounts_payable.findMany({
      where,
      orderBy: { dueDate: 'asc' },
      include: {
        suppliers: { select: { id: true, name: true, contact: true } },
        purchaseOrder: { select: { id: true, orderNumber: true } },
      },
    }),
    prisma.accounts_payable.count({ where }),
  ]);

  return { data, total };
}

export async function registerPaymentToPayable(
  accountPayableId: string,
  amount: number,
  paymentMethod: string,
  userId: string,
  reference?: string,
) {
  logger.info('[debtService] registerPaymentToPayable', { accountPayableId, amount });

  return prisma.$transaction(async (tx) => {
    const account = await tx.accounts_payable.findUnique({
      where: { id: accountPayableId },
    });

    if (!account) {
      throw new Error('Cuenta por pagar no encontrada');
    }

    const newPaidAmount = toNumber(account.paidAmount) + amount;
    const remainingBalance = toNumber(account.totalDebt) - newPaidAmount;
    const newStatus = remainingBalance <= 0 ? 'PAID' : 'PARTIALLY_PAID';

    await tx.accounts_payable.update({
      where: { id: accountPayableId },
      data: {
        paidAmount: newPaidAmount,
        remainingBalance: remainingBalance > 0 ? remainingBalance : 0,
        status: newStatus,
      },
    });

    return { success: true, newStatus, remainingBalance };
  });
}

// ============================================
// ESTADÍSTICAS Y UTILIDADES
// ============================================

export async function getDebtStats() {
  const [receivables, payables] = await Promise.all([
    prisma.accounts_receivable.aggregate({
      where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      _sum: { remainingBalance: true },
    }),
    prisma.accounts_payable.aggregate({
      where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] } },
      _sum: { remainingBalance: true },
    }),
  ]);

  return {
    totalReceivables: toNumber(receivables._sum.remainingBalance),
    totalPayables: toNumber(payables._sum.remainingBalance),
    netPosition: toNumber(receivables._sum.remainingBalance) - toNumber(payables._sum.remainingBalance),
  };
}

export async function markOverdueAccounts() {
  const today = new Date();
  const [receivablesUpdated, payablesUpdated] = await Promise.all([
    prisma.accounts_receivable.updateMany({
      where: {
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        dueDate: { lt: today },
        remainingBalance: { gt: 0 },
      },
      data: { status: 'OVERDUE' },
    }),
    prisma.accounts_payable.updateMany({
      where: {
        status: { in: ['PENDING', 'PARTIALLY_PAID'] },
        dueDate: { lt: today },
        remainingBalance: { gt: 0 },
      },
      data: { status: 'OVERDUE' },
    }),
  ]);

  return {
    receivablesUpdated: receivablesUpdated.count,
    payablesUpdated: payablesUpdated.count,
  };
}

