import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { generatePurchaseOrderNumber } from '../utils/purchaseOrderNumberGenerator';
import type {
  CreatePurchaseOrderInput,
  ReceivePurchaseOrderInput,
  ListPurchaseOrdersQuery,
  CancelPurchaseOrderInput,
} from '../utils/validators';

type PrismaTx = any;

export class OverreceiptError extends Error {
  constructor(
    public readonly productName: string,
    public readonly pending: number,
    public readonly attempted: number,
  ) {
    super(
      `No se puede recibir ${attempted} unidades de "${productName}". ` +
      `Solo quedan ${pending} unidades pendientes de recepción.`,
    );
    this.name = 'OverreceiptError';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CREAR ORDEN DE COMPRA
// ═══════════════════════════════════════════════════════════════════════════

export async function createPurchaseOrder(
  data: CreatePurchaseOrderInput,
  userId: string,
) {
  logger.info('Creating purchase order', {
    supplierId: data.supplierId,
    itemCount: data.items.length,
  });

  return prisma.$transaction(async (tx) => {
    const orderNumber = await generatePurchaseOrderNumber(tx as any);

    let subtotal = 0;
    const processedItems = [];

    for (const item of data.items) {
      const product = await (tx as PrismaTx).products.findUniqueOrThrow({
        where: { id: item.productId },
        select: { nameCommercial: true, skuInternal: true, isActive: true },
      });

      if (!product.isActive) {
        throw new Error(`El producto "${product.nameCommercial}" está desactivado.`);
      }

      const lineTotal = parseFloat((item.unitCost * item.quantityOrdered).toFixed(2));
      subtotal += lineTotal;

      processedItems.push({
        productId: item.productId,
        productNameSnapshot: product.nameCommercial,
        skuSnapshot: product.skuInternal,
        quantityOrdered: item.quantityOrdered,
        quantityReceived: 0,
        unitCost: String(item.unitCost),
        lineTotal: String(lineTotal),
      });
    }

    const taxAmount = parseFloat((subtotal * 0.19).toFixed(2));
    const totalAmount = parseFloat((subtotal + taxAmount).toFixed(2));

    const po = await (tx as PrismaTx).purchase_orders.create({
      data: {
        orderNumber,
        supplierId: data.supplierId,
        userId,
        status: 'PENDING',
        subtotal: String(parseFloat(subtotal.toFixed(2))),
        taxAmount: String(taxAmount),
        totalAmount: String(totalAmount),
        expectedDate: data.expectedDate ? new Date(data.expectedDate) : null,
        notes: data.notes,
        purchase_order_items: { create: processedItems },
      },
      include: {
        purchase_order_items: true,
        suppliers: { select: { id: true, name: true, nit: true, phone: true } },
      },
    });

    logger.info('Purchase order created', {
      orderId: po.id,
      orderNumber: po.orderNumber,
      total: totalAmount,
    });

    return po;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// RECEPCIÓN PARCIAL O TOTAL
// ═══════════════════════════════════════════════════════════════════════════

export async function receivePurchaseOrder(
  purchaseOrderId: string,
  receiveData: ReceivePurchaseOrderInput,
  userId: string,
) {
  logger.info('Starting purchase order reception', {
    purchaseOrderId,
    itemsToReceive: receiveData.items.length,
  });

  return prisma.$transaction(async (tx) => {
    const po = await (tx as PrismaTx).purchase_orders.findUnique({
      where: { id: purchaseOrderId },
      include: { purchase_order_items: true },
    });

    if (!po) throw new Error('Orden de compra no encontrada.');
    if (po.status === 'CANCELLED') {
      throw new Error('No se puede recibir mercancía de una OC cancelada.');
    }
    if (po.status === 'RECEIVED') {
      throw new Error('Esta OC ya fue completamente recibida.');
    }

    for (const incoming of receiveData.items) {
      const poItem = po.purchase_order_items.find((i) => i.id === incoming.purchaseOrderItemId);

      if (!poItem) {
        throw new Error(`El ítem "${incoming.purchaseOrderItemId}" no pertenece a esta OC.`);
      }

      const pendingQty = poItem.quantityOrdered - poItem.quantityReceived;

      if (incoming.quantityReceived > pendingQty) {
        throw new OverreceiptError(
          poItem.productNameSnapshot,
          pendingQty,
          incoming.quantityReceived,
        );
      }

      await (tx as PrismaTx).purchase_order_items.update({
        where: { id: incoming.purchaseOrderItemId },
        data: {
          quantityReceived: poItem.quantityReceived + incoming.quantityReceived,
        },
      });

      const product = await (tx as PrismaTx).products.findUniqueOrThrow({
        where: { id: poItem.productId },
        select: { stockQuantity: true, costPriceAvg: true },
      });

      const currentStock = product.stockQuantity;
      const currentCostAvg = Number(product.costPriceAvg);
      const purchaseUnitCost = Number(poItem.unitCost);
      const receivedQty = incoming.quantityReceived;

      const newCostAvg =
        currentStock + receivedQty === 0
          ? purchaseUnitCost
          : (currentStock * currentCostAvg + receivedQty * purchaseUnitCost) /
            (currentStock + receivedQty);

      await (tx as PrismaTx).products.update({
        where: { id: poItem.productId },
        data: {
          stockQuantity: currentStock + receivedQty,
          costPriceAvg: parseFloat(newCostAvg.toFixed(4)),
        },
      });

      await (tx as PrismaTx).inventory_movements.create({
        data: {
          productId: poItem.productId,
          type: 'ENTRY',
          quantity: receivedQty,
          unitCostAtMoment: purchaseUnitCost,
          referenceDoc: po.orderNumber,
          reason: `PURCHASE-OC-${po.orderNumber}`,
          performedByUserId: userId,
        } as any,
      });

      logger.info('Item received', {
        orderNumber: po.orderNumber,
        productId: poItem.productId,
        receivedQty,
        newStock: currentStock + receivedQty,
        newCostAvg: parseFloat(newCostAvg.toFixed(4)),
      });
    }

    const updatedItems = await (tx as PrismaTx).purchase_order_items.findMany({
      where: { purchaseOrderId },
    });

    const allReceived = updatedItems.every(
      (i) => i.quantityReceived >= i.quantityOrdered,
    );
    const anyReceived = updatedItems.some((i) => i.quantityReceived > 0);

    const newStatus = allReceived
      ? 'RECEIVED'
      : anyReceived
        ? 'PARTIALLY_RECEIVED'
        : 'PENDING';

    const updatedPO = await (tx as PrismaTx).purchase_orders.update({
      where: { id: purchaseOrderId },
      data: {
        status: newStatus,
        ...(newStatus === 'RECEIVED' && { receivedDate: new Date() }),
      },
      include: {
        suppliers: { select: { id: true, name: true, nit: true } },
        purchase_order_items: {
          include: {
            products: {
              select: {
                id: true,
                nameCommercial: true,
                skuInternal: true,
                stockQuantity: true,
                costPriceAvg: true,
              },
            },
          },
        },
      },
    });

    logger.info('Purchase order reception complete', {
      orderNumber: po.orderNumber,
      newStatus,
    });

    return updatedPO;
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// CANCELAR ORDEN
// ═══════════════════════════════════════════════════════════════════════════

export async function cancelPurchaseOrder(
  id: string,
  data: CancelPurchaseOrderInput,
  userId: string,
) {
  const po = await prisma.purchase_orders.findUnique({
    where: { id },
    select: { status: true, orderNumber: true },
  });

  if (!po) throw new Error('Orden de compra no encontrada.');

  if (po.status !== 'PENDING') {
    throw new Error(
      `Solo se pueden cancelar OCs en estado PENDING. Estado actual: ${po.status}.`,
    );
  }

  const updated = await prisma.purchase_orders.update({
    where: { id },
    data: {
      status: 'CANCELLED',
      ...(data.reason && { notes: `[CANCELADA por ${userId}] ${data.reason}` }),
    },
  });

  logger.info('Purchase order cancelled', {
    orderId: id,
    orderNumber: po.orderNumber,
    userId,
  });

  return updated;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSULTAS
// ═══════════════════════════════════════════════════════════════════════════

export async function getPurchaseOrderById(id: string) {
  return prisma.purchase_orders.findFirst({
    where: { OR: [{ id }, { orderNumber: id }] },
    include: {
      suppliers: true,
      purchase_order_items: {
        include: {
          products: {
            select: {
              id: true,
              skuInternal: true,
              nameCommercial: true,
              locationBin: true,
              stockQuantity: true,
              costPriceAvg: true,
              isActive: true,
            },
          },
        },
      },
    },
  });
}

export async function getPurchaseOrders(query: ListPurchaseOrdersQuery) {
  const { page, limit, supplierId, status, startDate, endDate, sortBy } = query;
  const skip = (page - 1) * limit;
  const [sortField, sortDir] = sortBy.split(':') as [string, 'asc' | 'desc'];

  const where: any = {
    ...(supplierId && { supplierId }),
    ...(status && { status }),
    ...((startDate ?? endDate) && {
      createdAt: {
        ...(startDate && { gte: new Date(startDate) }),
        ...(endDate && { lte: new Date(endDate) }),
      },
    }),
  };

  const [orders, total] = await prisma.$transaction([
    prisma.purchase_orders.findMany({
      where,
      skip,
      take: limit,
      orderBy: { [sortField]: sortDir },
      include: {
        suppliers: { select: { id: true, name: true, nit: true } },
        purchase_order_items: {
          select: {
            id: true,
            productNameSnapshot: true,
            quantityOrdered: true,
            quantityReceived: true,
            unitCost: true,
            lineTotal: true,
          },
        },
      },
    }),
    prisma.purchase_orders.count({ where }),
  ]);

  return {
    data: orders,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}
