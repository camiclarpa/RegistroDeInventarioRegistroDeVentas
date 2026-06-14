import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export async function createFromSaleItem(saleItemId: string, productId: string, customerId: string): Promise<boolean> {
  const product = await prisma.products.findUnique({
    where: { id: productId },
    select: { warrantyDays: true, nameCommercial: true },
  });
  if (!product || product.warrantyDays <= 0) return false;
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + product.warrantyDays);
  await prisma.warranties.create({
    data: {
      customerId,
      saleItemId,
      productName: product.nameCommercial,
      days: product.warrantyDays,
      expiresAt,
      status: 'ACTIVE',
    } as any,
  });
  logger.info(`[warrantyService] Garantía: ${productId} (${product.warrantyDays}d) → ${customerId}`);
  return true;
}

export async function createWarrantiesFromSale(saleId: string, customerId: string): Promise<number> {
  const items = await prisma.sale_items.findMany({
    where: { saleId },
    select: { id: true, productId: true },
  });
  let count = 0;
  for (const item of items) {
    if (await createFromSaleItem(item.id, item.productId, customerId)) count++;
  }
  if (count > 0) logger.info(`[warrantyService] ${count} garantía(s) para venta ${saleId}`);
  return count;
}

export async function getActiveWarranties(customerId: string) {
  return prisma.warranties.findMany({
    where: {
      customerId,
      status: 'ACTIVE',
      expiresAt: { gt: new Date() },
    },
    orderBy: { expiresAt: 'asc' },
  });
}

export async function getAllWarranties(customerId: string) {
  return prisma.warranties.findMany({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function markWarrantyClaimed(warrantyId: string, notes: string) {
  const warranty = await prisma.warranties.findUnique({ where: { id: warrantyId } });
  if (!warranty) throw new Error('Garantía no encontrada');
  if (warranty.status !== 'ACTIVE') throw new Error(`Estado actual: ${warranty.status}`);
  return prisma.warranties.update({
    where: { id: warrantyId },
    data: { status: 'CLAIMED', claimNotes: notes } as any,
  });
}

export async function expireOldWarranties(): Promise<number> {
  const result = await prisma.warranties.updateMany({
    where: { status: 'ACTIVE', expiresAt: { lt: new Date() } },
    data: { status: 'EXPIRED' },
  });
  if (result.count > 0) logger.info(`[warrantyService] ${result.count} garantía(s) expiradas`);
  return result.count;
}

