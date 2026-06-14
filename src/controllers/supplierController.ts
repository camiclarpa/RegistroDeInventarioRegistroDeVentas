import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

const fail = (res: Response, error: string, status = 400) =>
  res.status(status).json({ success: false, error });

export async function getSuppliers(req: Request, res: Response): Promise<Response> {
  try {
    const suppliers = await prisma.suppliers.findMany({
      orderBy: { name: 'asc' }
    });
    return ok(res, suppliers);
  } catch (err) {
    logger.error('[supplierController] getSuppliers', err);
    return fail(res, 'Error al obtener proveedores', 500);
  }
}

export async function createSupplier(req: Request, res: Response): Promise<Response> {
  try {
    const { name, email, phone, address, taxId } = req.body;
    const supplier = await prisma.suppliers.create({
      data: { name, email, phone, address, taxId } as any
    });
    return ok(res, supplier, 201);
  } catch (err) {
    logger.error('[supplierController] createSupplier', err);
    return fail(res, 'Error al crear proveedor', 500);
  }
}

export async function getSupplierById(req: Request, res: Response): Promise<Response> {
  try {
    const { id } = req.params;
    const supplier = await prisma.suppliers.findUnique({
      where: { id: id as string }
    });
    if (!supplier) return fail(res, 'Proveedor no encontrado', 404);
    return ok(res, supplier);
  } catch (err) {
    logger.error('[supplierController] getSupplierById', err);
    return fail(res, 'Error al obtener proveedor', 500);
  }
}

export async function deactivateSupplierHandler(req: Request, res: Response): Promise<Response> {
  try {
    const id = req.params.id as string;
    const { reason } = req.body;

    if (!reason || reason.trim().length < 5) {
      return res.status(400).json({ success: false, error: 'El motivo de desactivación es obligatorio (mínimo 5 caracteres).' });
    }

    const supplier = await prisma.suppliers.findUnique({
      where: { id },
      include: {
        purchase_orders: {
          where: { status: 'PENDING' },
          select: { id: true, orderNumber: true }
        }
      }
    });

    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    if (supplier.purchase_orders && supplier.purchase_orders.length > 0) {
      const orderNumbers = supplier.purchase_orders.map((o: any) => o.orderNumber).join(', ');
      return res.status(400).json({
        success: false,
        error: `No se puede desactivar: El proveedor tiene órdenes de compra PENDIENTES (${orderNumbers}). Recíbalas o cancélelas primero.`
      });
    }

    const userId = (req as any).user?.id || 'Sistema';

    await prisma.suppliers.update({
      where: { id },
      data: {
        isActive: false,
        deactivationReason: reason,
        deactivatedAt: new Date(),
        deactivatedBy: userId
      } as any
    });

    logger.info(`[supplierController] Proveedor desactivado: ${supplier.name} (${id}) por ${userId}. Motivo: ${reason}`);
    return res.json({ success: true, message: 'Proveedor desactivado exitosamente' });
  } catch (error: any) {
    logger.error('[supplierController] deactivateSupplierHandler', error);
    return res.status(500).json({ success: false, error: 'Error al desactivar el proveedor' });
  }
}

export async function reactivateSupplierHandler(req: Request, res: Response): Promise<Response> {
  try {
    const id = req.params.id as string;
    const supplier = await prisma.suppliers.findUnique({ where: { id } });

    if (!supplier) return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    if (supplier.isActive) return res.status(400).json({ success: false, error: 'El proveedor ya está activo' });

    await prisma.suppliers.update({
      where: { id },
      data: {
        isActive: true,
        deactivationReason: null,
        deactivatedAt: null,
        deactivatedBy: null
      } as any
    });

    logger.info(`[supplierController] Proveedor reactivado: ${supplier.name} (${id})`);
    return res.json({ success: true, message: 'Proveedor reactivado exitosamente' });
  } catch (error: any) {
    logger.error('[supplierController] reactivateSupplierHandler', error);
    return res.status(500).json({ success: false, error: 'Error al reactivar el proveedor' });
  }
}

export async function getSupplierStats(req: Request, res: Response): Promise<Response> {
  try {
    const id = req.params.id as string;

    const supplier = await prisma.suppliers.findUnique({ where: { id } });
    if (!supplier) {
      return res.status(404).json({ success: false, error: 'Proveedor no encontrado' });
    }

    const orders = await prisma.purchase_orders.findMany({
      where: { supplierId: id },
      select: {
        id: true,
        orderNumber: true,
        status: true,
        totalAmount: true,
        createdAt: true,
        receivedDate: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    const totalOrders = orders.length;
    const totalAmount = orders.reduce((sum, o) => sum + Number(o.totalAmount || 0), 0);
    const lastOrder = orders[0];

    const ordersByStatus = {
      PENDING: orders.filter(o => o.status === 'PENDING').length,
      PARTIALLY_RECEIVED: orders.filter(o => o.status === 'PARTIALLY_RECEIVED').length,
      RECEIVED: orders.filter(o => o.status === 'RECEIVED').length,
      CANCELLED: orders.filter(o => o.status === 'CANCELLED').length,
    };

    const lastOrderDate = lastOrder ? lastOrder.createdAt.toISOString() : null;
    const lastOrderNumber = lastOrder ? lastOrder.orderNumber : null;
    const lastOrderStatus = lastOrder ? lastOrder.status : null;

    logger.info(`[supplierController] Stats para proveedor ${id}: ${totalOrders} órdenes, $${totalAmount}`);

    return res.json({
      success: true,
      data: {
        totalOrders,
        totalAmount: parseFloat(totalAmount.toFixed(2)),
        lastOrderDate,
        lastOrderNumber,
        lastOrderStatus,
        ordersByStatus,
      },
    });
  } catch (error: any) {
    logger.error('[supplierController] getSupplierStats', error);
    return res.status(500).json({ success: false, error: 'Error al obtener estadísticas del proveedor' });
  }
}

