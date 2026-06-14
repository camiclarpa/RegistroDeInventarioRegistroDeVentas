import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

interface CreateMovementInput {
  productId: string;
  type: string;
  quantity: number;
  unitCost: number | string;
  referenceDoc?: string;
  reason?: string;
  userId?: string;
}

export async function createMovement(data: CreateMovementInput) {
  const movement = await prisma.inventory_movements.create({
    data: {
      productId: data.productId,
      type: data.type,
      quantity: Math.abs(data.quantity),
      unitCostAtMoment: typeof data.unitCost === 'string' ? parseFloat(data.unitCost) : data.unitCost,
      referenceDoc: data.referenceDoc,
      reason: data.reason,
      performedByUserId: data.userId,
    } as any,
  });

  logger.info('InventoryMovement created', {
    movementId: movement.id,
    productId: data.productId,
    type: data.type,
    qty: data.quantity,
  });

  return movement;
}

export async function getMovementsByProduct(productId: string, limit = 50) {
  return prisma.inventory_movements.findMany({
    where: { productId },
    orderBy: { timestamp: 'desc' },
    take: limit,
  });
}

