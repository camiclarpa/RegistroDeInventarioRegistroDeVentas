/**
 * posService.ts — Módulo 2: Punto de Venta (POS)
 */

import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import type { CreateSaleInput, ListSalesQuery, CancelSaleInput, SearchCustomersQuery } from '../utils/validators';

export { InsufficientStockError } from './saleService';
import { InsufficientStockError } from './saleService';
import { searchCustomers as customerServiceSearch } from './customerService';

// ─── Tipos internos ───────────────────────────────────────────────────────────

type PrismaTx = any;

export interface PosProduct {
  id: string;
  nameCommercial: string;
  skuInternal: string;
  barcodeExternal: string | null;
  salePriceBase: number;
  taxRate: number;
  stockQuantity: number;
  isActive: boolean;
  imageKey: string | null;
  locationBin: string;
}

export interface SaleTotals {
  subtotal: number;
  discountAmount: number;
  taxableBase: number;
  taxAmount: number;
  totalAmount: number;
}

const round2 = (n: number): number => Math.round(n * 100) / 100;

// ═══════════════════════════════════════════════════════════════════════════
// BÚSQUEDA DE PRODUCTO
// ═══════════════════════════════════════════════════════════════════════════

export async function findProductByCode(code: string): Promise<PosProduct | null> {
  const product = await prisma.products.findFirst({
    where: {
      isActive: true,
      OR: [
        { barcodeExternal: code },
        { skuInternal: code },
      ],
    },
    select: {
      id: true,
      nameCommercial: true,
      skuInternal: true,
      barcodeExternal: true,
      salePriceBase: true,
      taxRate: true,
      stockQuantity: true,
      imageKey: true,
      locationBin: true,
      isActive: true,
    },
  });

  if (!product) return null;
  return {
    id: product.id,
    nameCommercial: product.nameCommercial,
    skuInternal: product.skuInternal,
    barcodeExternal: product.barcodeExternal,
    salePriceBase: Number(product.salePriceBase),
    taxRate: Number(product.taxRate),
    stockQuantity: product.stockQuantity,
    imageKey: product.imageKey,
    locationBin: product.locationBin,
    isActive: product.isActive,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// VALIDACIÓN DE STOCK
// ═══════════════════════════════════════════════════════════════════════════

export async function validateStockAvailability(
  items: Array<{ productId: string; quantity: number }>,
): Promise<void> {
  const products = await Promise.all(
    items.map((item) =>
      prisma.products.findUnique({
        where: { id: item.productId },
        select: { id: true, nameCommercial: true, stockQuantity: true, isActive: true },
      }),
    ),
  );

  for (let i = 0; i < items.length; i++) {
    const product = products[i];
    const item = items[i];
    if (!product) {
      throw new Error(`Producto con id "${item.productId}" no encontrado.`);
    }
    if (!product.isActive) {
      throw new Error(`El producto "${product.nameCommercial}" está desactivado.`);
    }
    if (product.stockQuantity < item.quantity) {
      throw new InsufficientStockError(
        product.nameCommercial,
        product.stockQuantity,
        item.quantity,
      );
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CÁLCULO DE TOTALES
// ═══════════════════════════════════════════════════════════════════════════

export function calculateSaleTotals(
  items: Array<{ quantity: number; unitPrice: number; discountPerItem?: number }>,
  globalDiscountAmount = 0,
  taxRate = 19,
): SaleTotals {
  let subtotalCents = 0;
  for (const item of items) {
    const lineCents =
      Math.round(item.unitPrice * item.quantity * 100) -
      Math.round((item.discountPerItem ?? 0) * 100);
    subtotalCents += lineCents;
  }
  const discountCents = Math.round(globalDiscountAmount * 100);
  const taxBaseCents = Math.max(0, subtotalCents - discountCents);
  const taxAmountCents = Math.round((taxBaseCents * taxRate) / 100);
  const totalCents = taxBaseCents + taxAmountCents;
  return {
    subtotal: round2(subtotalCents / 100),
    discountAmount: round2(discountCents / 100),
    taxableBase: round2(taxBaseCents / 100),
    taxAmount: round2(taxAmountCents / 100),
    totalAmount: round2(totalCents / 100),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// NÚMERO DE FACTURA
// ═══════════════════════════════════════════════════════════════════════════

export async function generateInvoiceNumber(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `FAC-${year}-`;
  const last = await prisma.sales.findFirst({
    where: { saleNumber: { startsWith: prefix } },
    orderBy: { saleNumber: 'desc' },
    select: { saleNumber: true },
  });
  if (!last?.saleNumber) return `${prefix}00001`;
  const lastNum = parseInt(last.saleNumber.slice(prefix.length), 10);
  const nextNum = (lastNum + 1).toString().padStart(5, '0');
  return `${prefix}${nextNum}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// TRANSACCIÓN DE VENTA
// ═══════════════════════════════════════════════════════════════════════════

export async function processSaleTransaction(data: CreateSaleInput, userId: string) {
  logger.info('[posService] Starting POS sale transaction', {
    userId,
    itemCount: data.items.length,
    paymentMethod: data.paymentMethod,
  });

  const sale = await prisma.$transaction(async (tx) => {
    const invoiceNumber = await generateInvoiceNumber();

    let subtotalCents = 0;
    const processedItems = await Promise.all(
      data.items.map(async (rawItem) => {
        const product = await (tx as PrismaTx).products.findUnique({
          where: { id: rawItem.productId },
          select: {
            id: true,
            nameCommercial: true,
            skuInternal: true,
            costPriceAvg: true,
            salePriceBase: true,
            stockQuantity: true,
            isActive: true,
          },
        });

        if (!product) throw new Error(`Producto "${rawItem.productId}" no encontrado.`);
        if (!product.isActive) throw new Error(`El producto "${product.nameCommercial}" está desactivado.`);
        if (product.stockQuantity < rawItem.quantity) {
          throw new InsufficientStockError(product.nameCommercial, product.stockQuantity, rawItem.quantity);
        }

        const unitPrice = rawItem.unitPrice ?? Number(product.salePriceBase);
        const discountItem = rawItem.discountPerItem ?? 0;
        const lineCents = Math.round(unitPrice * rawItem.quantity * 100) - Math.round(discountItem * 100);
        subtotalCents += lineCents;

        const newStock = product.stockQuantity - rawItem.quantity;
        await (tx as PrismaTx).products.update({
          where: { id: rawItem.productId },
          data: { stockQuantity: newStock },
        });

        await (tx as PrismaTx).inventory_movements.create({
          data: {
            productId: rawItem.productId,
            type: 'EXIT',
            quantity: rawItem.quantity,
            unitCostAtMoment: product.costPriceAvg,
            referenceDoc: invoiceNumber,
            reason: `VENTA-${invoiceNumber}`,
            performedByUserId: userId,
          },
        });

        return {
          productId: rawItem.productId,
          productNameSnapshot: product.nameCommercial,
          skuSnapshot: product.skuInternal,
          quantity: rawItem.quantity,
          unitPrice: String(round2(unitPrice)),
          discountPerItem: String(round2(discountItem)),
          lineTotal: String(round2(lineCents / 100)),
        };
      }),
    );

    const discountCents = Math.round((data.discountAmount ?? 0) * 100);
    const taxBaseCents = Math.max(0, subtotalCents - discountCents);
    const config = await prisma.business_config.findFirst();
    const taxRateNum = config?.taxRate !== undefined ? Number(config.taxRate) : 19;
    const taxAmountCents = Math.round((taxBaseCents * taxRateNum) / 100);
    const totalCents = taxBaseCents + taxAmountCents;

    const created = await (tx as PrismaTx).sales.create({
      data: {
        saleNumber: invoiceNumber,
        customerId: data.customerId ?? null,
        userId,
        subtotal: String(round2(subtotalCents / 100)),
        discountAmount: String(round2(discountCents / 100)),
        taxAmount: String(round2(taxAmountCents / 100)),
        totalAmount: String(round2(totalCents / 100)),
        paymentMethod: data.paymentMethod,
        status: 'COMPLETED',
        notes: data.notes ?? null,
        items: { create: processedItems },
      },
      include: { items: true, customers: { select: { id: true, nameCommercial: true, phone: true } } },
    });

    logger.info('[posService] POS sale created', { saleId: created.id, invoice: invoiceNumber });
    return created;
  });

  return sale;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSULTAS DE VENTAS
// ═══════════════════════════════════════════════════════════════════════════

export async function getSaleById(identifier: string) {
  const sale = await prisma.sales.findFirst({
    where: { OR: [{ id: identifier }, { saleNumber: identifier }] },
    include: {
      customers: { select: { id: true, nameCommercial: true, phone: true, identificationNumber: true } },
      items: true,
    },
  });
  if (!sale) return null;
  const cashier = await prisma.users.findUnique({ where: { id: sale.userId }, select: { id: true, nameCommercial: true } }).catch(() => null);
  return { ...sale, cashier };
}

export async function getAllSales(query: ListSalesQuery, callerId: string, isAdmin: boolean) {
  const { page, limit, startDate, endDate, customerId, status, paymentMethod, sortBy } = query;
  const skip = (page - 1) * limit;
  const [sortField, sortDir] = sortBy.split(':') as [string, 'asc' | 'desc'];
  const where: any = {
    ...(!isAdmin && { userId: callerId }),
    ...(customerId && { customerId }),
    ...(status && { status }),
    ...(paymentMethod && { paymentMethod }),
    ...((startDate ?? endDate) && {
      createdAt: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      },
    }),
  };
  const [sales, total] = await prisma.$transaction([
    prisma.sales.findMany({ where, skip, take: limit, orderBy: { [sortField]: sortDir } }),
    prisma.sales.count({ where }),
  ]);
  return { data: sales, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

// ═══════════════════════════════════════════════════════════════════════════
// CANCELACIÓN DE VENTA
// ═══════════════════════════════════════════════════════════════════════════

export async function cancelSale(id: string, data: CancelSaleInput, userId: string) {
  const sale = await prisma.sales.findFirst({
    where: { OR: [{ id }, { saleNumber: id }] },
    include: { sale_items: true },
  });
  if (!sale) throw new Error('Venta no encontrada.');
  if (sale.status !== 'COMPLETED') {
    throw new Error(`No se puede cancelar una venta en estado "${sale.status}".`);
  }
  await prisma.$transaction(async (tx) => {
    for (const item of sale.sale_items) {
      const product = await (tx as PrismaTx).products.findUnique({
        where: { id: item.productId },
        select: { stockQuantity: true, costPriceAvg: true },
      });
      if (product) {
        await (tx as PrismaTx).products.update({
          where: { id: item.productId },
          data: { stockQuantity: product.stockQuantity + item.quantity },
        });
        await (tx as PrismaTx).inventory_movements.create({
          data: {
            productId: item.productId,
            type: 'RETURN',
            quantity: item.quantity,
            unitCostAtMoment: product.costPriceAvg,
            referenceDoc: sale.id,
            reason: `CANCELACION-${sale.id}: ${data.reason}`,
            performedByUserId: userId,
          },
        });
      }
    }
    await (tx as PrismaTx).sales.update({
      where: { id: sale.id },
      data: { status: 'CANCELLED', notes: `[CANCELADA por ${userId}] ${data.reason}` },
    });
  });
  return { saleId: sale.id, saleNumber: sale.saleNumber, status: 'CANCELLED' };
}

// ═══════════════════════════════════════════════════════════════════════════
// CLIENTES
// ═══════════════════════════════════════════════════════════════════════════

export async function searchCustomers(query: SearchCustomersQuery) {
  return customerServiceSearch(query);
}

