import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { getCurrentOpenRegister } from './cashRegisterService';

export interface CreateTransactionInput {
  type: string;
  amount: number;
  description: string;
  category: string;
  paymentMethod: string;
  referenceType?: string;
  referenceId?: string;
}

export async function createTransaction(
  data: CreateTransactionInput,
  userId: string,
  cashRegisterId?: string,
) {
  const registerId = cashRegisterId ?? (await getCurrentOpenRegister())?.id;

  if (!registerId) {
    throw new Error('No hay caja abierta. Abre una caja antes de registrar movimientos.');
  }

  if (data.amount <= 0) {
    throw new Error('El monto debe ser mayor que cero');
  }

  const tx = await prisma.financial_transactions.create({
    data: {
      cashRegisterId: registerId,
      type: data.type,
      amount: data.amount,
      description: data.description,
      category: data.category,
      paymentMethod: data.paymentMethod,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      performedByUserId: userId,
    } as any,
  });

  logger.info(`[financialTransactionService] ${data.type} $${data.amount} en caja ${registerId}`);
  return tx;
}

export async function createIncomeFromSale(
  saleId: string,
  amount: number,
  paymentMethod: string,
  userId: string,
) {
  const openRegister = await getCurrentOpenRegister();

  if (!openRegister) {
    logger.warn(`[financialTransactionService] Venta ${saleId} registrada sin caja abierta — income no registrado`);
    return null;
  }

  return createTransaction(
    {
      type: 'INCOME',
      amount,
      description: `Venta ${saleId}`,
      category: 'Venta',
      paymentMethod,
      referenceType: 'SALE',
      referenceId: saleId,
    },
    userId,
    openRegister.id,
  );
}

export async function createPaymentReceivedTransaction(
  receivableId: string,
  amount: number,
  paymentMethod: string,
  userId: string,
  description: string,
  cashRegisterId?: string,
) {
  const registerId = cashRegisterId ?? (await getCurrentOpenRegister())?.id;

  if (!registerId) {
    logger.warn(`[financialTransactionService] Abono CxC ${receivableId} sin caja abierta — no registrado en caja`);
    return null;
  }

  return createTransaction(
    {
      type: 'PAYMENT_RECEIVED',
      amount,
      description,
      category: 'Cobro Cartera',
      paymentMethod,
      referenceType: 'ACCOUNT_RECEIVABLE',
      referenceId: receivableId,
    },
    userId,
    registerId,
  );
}

export async function createPaymentMadeTransaction(
  payableId: string,
  amount: number,
  paymentMethod: string,
  userId: string,
  description: string,
  cashRegisterId?: string,
) {
  const registerId = cashRegisterId ?? (await getCurrentOpenRegister())?.id;

  if (!registerId) {
    logger.warn(`[financialTransactionService] Pago CxP ${payableId} sin caja abierta — no registrado en caja`);
    return null;
  }

  return createTransaction(
    {
      type: 'PAYMENT_MADE',
      amount,
      description,
      category: 'Pago Proveedor',
      paymentMethod,
      referenceType: 'ACCOUNT_PAYABLE',
      referenceId: payableId,
    },
    userId,
    registerId,
  );
}

export async function listTransactions(cashRegisterId: string) {
  return prisma.financial_transactions.findMany({
    where: { cashRegisterId },
    orderBy: { timestamp: 'desc' },
  });
}

