import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { generateSaleNumber } from '../utils/saleNumberGenerator';
import type { CreateSaleInput, ListSalesQuery, CancelSaleInput } from '../utils/validators';
import { refreshCustomerRfm } from './crmAnalyticsService';

// ─── Tipos internos ──────────────────────────────────────────────────────────

type PrismaTx = any;

export class InsufficientStockError extends Error {
  constructor(
    public readonly productName: string,
    public readonly available: number,
    public readonly requested: number,
  ) {
    super(
      `Stock insuficiente para "${productName}". Disponible: ${available}, solicitado: ${requested}.`,
    );
    this.name = 'InsufficientStockError';
  }
}

interface ProcessedItem {
  productId: string;
  productNameSnapshot: string;
  skuSnapshot: string;
  quantity: number;
  unitPrice: string;
  discountPerItem: string;
  lineTotal: string;
}

async function processItem(
  tx: PrismaTx,
  rawItem: CreateSaleInput['items'][number],
  saleNumber: string,
  userId: string,
): Promise<{ item: ProcessedItem; lineSubtotal: number }> {
  const product = await tx.products.findUnique({
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

  if (!product) {
    throw new Error(`Producto con id "${rawItem.productId}" no encontrado.`);
  }
  if (!product.isActive) {
    throw new Error(`El producto "${product.nameCommercial}" está desactivado y no se puede vender.`);
  }
  if (product.stockQuantity < rawItem.quantity) {
    throw new InsufficientStockError(
      product.nameCommercial,
      product.stockQuantity,
      rawItem.quantity,
    );
  }

  const unitPrice = rawItem.unitPrice ?? Number(product.salePriceBase);
  const discountPerItem = rawItem.discountPerItem ?? 0;
  const lineTotal = parseFloat((unitPrice * rawItem.quantity - discountPerItem).toFixed(2));
  const newStock = product.stockQuantity - rawItem.quantity;

  await tx.products.update({
    where: { id: rawItem.productId },
    data: { stockQuantity: newStock },
  });

  await tx.inventory_movements.create({
    data: {
      productId: rawItem.productId,
      type: 'EXIT',
      quantity: rawItem.quantity,
      unitCostAtMoment: product.costPriceAvg,
      referenceDoc: saleNumber,
      reason: `SALE-${saleNumber}`,
      performedByUserId: userId,
    } as any,
  });

  return {
    item: {
      productId: rawItem.productId,
      productNameSnapshot: product.nameCommercial,
      skuSnapshot: product.skuInternal,
      quantity: rawItem.quantity,
      unitPrice: String(unitPrice),
      discountPerItem: String(discountPerItem),
      lineTotal: String(lineTotal),
    },
    lineSubtotal: lineTotal,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICIO PRINCIPAL
// ═══════════════════════════════════════════════════════════════════════════

export async function createSale(data: CreateSaleInput, userId: string) {
  logger.info('Starting sale creation transaction', {
    userId,
    itemCount: data.items.length,
    paymentMethod: data.paymentMethod,
  });

  const sale = await prisma.$transaction(async (tx) => {
    const saleNumber = await generateSaleNumber(tx as any);

    let subtotal = 0;
    const processedItems: ProcessedItem[] = [];

    for (const rawItem of data.items) {
      const { item, lineSubtotal } = await processItem(tx as PrismaTx, rawItem, saleNumber, userId);
      processedItems.push(item);
      subtotal += lineSubtotal;
    }

    const discountAmount = data.discountAmount ?? 0;
    const taxableBase = Math.max(0, subtotal - discountAmount);
    const taxAmount = parseFloat((taxableBase * 0.19).toFixed(2));
    const totalAmount = parseFloat((taxableBase + taxAmount).toFixed(2));

    const created = await (tx as PrismaTx).sales.create({
      data: {
        saleNumber,
        customerId: data.customerId ?? null,
        userId,
        subtotal: String(parseFloat(subtotal.toFixed(2))),
        discountAmount: String(discountAmount),
        taxAmount: String(taxAmount),
        totalAmount: String(totalAmount),
        paymentMethod: data.paymentMethod,
        status: 'COMPLETED',
        notes: data.notes,
        sale_items: { create: processedItems },
      },
      include: {
        sale_items: true,
        customers: true,
      },
    });

    logger.info('Sale created successfully', {
      saleId: created.id,
      saleNumber: created.saleNumber,
      total: totalAmount,
    });

    return created;
  });

  if (sale.customerId) {
    await updateCustomerAfterSale(sale.customerId, sale.id, Number(sale.totalAmount));
  }

  return sale;
}

export async function getSaleById(id: string) {
  return prisma.sales.findFirst({
    where: { OR: [{ id }, { saleNumber: id }] },
    include: {
      customers: true,
      sale_items: {
        include: {
          products: {
            select: {
              id: true,
              skuInternal: true,
              nameCommercial: true,
              locationBin: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
}

export async function cancelSale(id: string, data: CancelSaleInput, userId: string) {
  const sale = await prisma.sales.findUnique({
    where: { id },
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
            referenceDoc: sale.saleNumber,
            reason: `CANCEL-${sale.saleNumber}: ${data.reason}`,
            performedByUserId: userId,
          } as any,
        });
      }
    }

    await (tx as PrismaTx).sales.update({
      where: { id },
      data: { status: 'CANCELLED', notes: `[CANCELADA] ${data.reason}` },
    });
  });

  logger.info('Sale cancelled', { saleId: id, saleNumber: sale.saleNumber, userId });
  return { saleNumber: sale.saleNumber, status: 'CANCELLED' };
}

export async function getSales(query: ListSalesQuery) {
  const { page, limit, startDate, endDate, customerId, status, paymentMethod, sortBy } = query;
  const skip = (page - 1) * limit;
  const [sortField, sortDir] = sortBy.split(':') as [string, 'asc' | 'desc'];

  const where: any = {
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
    prisma.sales.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortField]: sortDir },
      include: {
        customers: { select: { id: true, nameCommercial: true, phone: true, identificationNumber: true } },
        sale_items: { select: { id: true, productNameSnapshot: true, quantity: true, lineTotal: true } },
      },
    }),
    prisma.sales.count({ where }),
  ]);

  return { data: sales, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

async function updateCustomerAfterSale(customerId: string, saleId: string, totalAmount: number) {
  if (!customerId) return;

  try {
    const pointsEarned = Math.floor(totalAmount / 10000);

    await prisma.customers.update({
      where: { id: customerId },
      data: {
        totalSpent: { increment: totalAmount },
        purchaseCount: { increment: 1 },
        lastPurchaseAt: new Date(),
        loyaltyPoints: { increment: pointsEarned },
      },
    });

    const saleItems = await prisma.sale_items.findMany({
      where: { saleId },
      include: {
        products: { select: { id: true, nameCommercial: true, warrantyDays: true } },
      },
    });

    for (const item of saleItems) {
      if (item.products?.warrantyDays && item.products.warrantyDays > 0) {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + item.products.warrantyDays);

        await prisma.warranties.create({
          data: {
            customerId,
            saleItemId: item.id,
            productName: item.products.nameCommercial,
            days: item.products.warrantyDays,
            expiresAt,
            status: 'ACTIVE',
          } as any,
        });
      }
    }

    try {
      await refreshCustomerRfm(customerId);
    } catch (rfmError) {
      logger.error('Error updating RFM for customer', { customerId, error: rfmError });
    }
  } catch (error) {
    logger.error('Error updating customer after sale', { customerId, saleId, error });
  }
}

