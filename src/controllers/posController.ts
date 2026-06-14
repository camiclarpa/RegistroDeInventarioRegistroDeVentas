import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import {
  createSaleSchema,
  cancelSaleSchema,
  listSalesQuerySchema,
  searchCustomersQuerySchema,
} from '../utils/validators';
import {
  findProductByCode,
  validateStockAvailability,
  calculateSaleTotals,
  processSaleTransaction,
  getSaleById,
  getAllSales,
  cancelSale,
  searchCustomers,
  InsufficientStockError,
} from '../services/posService';
import { createIncomeFromSale } from '../services/financialTransactionService';
import { createReceivableFromSale } from '../services/debtService';
import { logAction } from '../services/auditService';
import { logger } from '../config/logger';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

const fail = (res: Response, error: string, status = 400, details?: unknown) =>
  res.status(status).json({ success: false, error, ...(details ? { details } : {}) });

function extractParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

function handleError(res: Response, err: unknown, context: string) {
  logger.error(`[PosController] ${context}`, { err });

  if (err instanceof ZodError) {
    return fail(res, 'Datos de entrada inválidos', 422, err.flatten());
  }

  if (err instanceof InsufficientStockError) {
    return fail(res, err.message, 409, {
      type: 'INSUFFICIENT_STOCK',
      product: err.productName,
      available: err.available,
      requested: err.requested,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return fail(res, 'Ya existe un registro con esos datos', 409);
    if (err.code === 'P2025') return fail(res, 'Registro no encontrado', 404);
  }

  if (err instanceof Error) return fail(res, err.message, 400);
  return fail(res, 'Error interno del servidor', 500);
}

export async function getProductByBarcode(req: Request, res: Response) {
  try {
    const code = extractParam(req.params['code']).trim();
    const product = await findProductByCode(code);
    if (!product) return fail(res, `Producto no encontrado para el código "${code}"`, 404);
    const base = Number(product.salePriceBase);
    const tax = Number(product.taxRate);
    return ok(res, { ...product, salePriceWithTax: Math.round((base * (1 + tax / 100)) * 100) / 100 });
  } catch (err) {
    return handleError(res, err, 'getProductByBarcode');
  }
}

export async function createSale(req: Request, res: Response) {
  try {
    const input = createSaleSchema.parse(req.body);
    const userId = req.user?.id ?? 'unknown';

    await validateStockAvailability(input.items.map(i => ({ productId: i.productId, quantity: i.quantity })));

    const sale = await processSaleTransaction(input, userId);
    const total = Number(sale.total);

    if (input.paymentMethod === 'CREDIT') {
      if (sale.customerId) {
        void createReceivableFromSale(sale.id, sale.customerId, total).catch(e =>
          logger.error('[posController] Error al crear CxC', { err: e, saleId: sale.id })
        );
      }
    } else {
      void createIncomeFromSale(sale.id, total, input.paymentMethod, userId).catch(e =>
        logger.error('[posController] Error al registrar ingreso en caja', { err: e, saleId: sale.id })
      );
    }

    void logAction(userId, 'POS_SALE_COMPLETED', 'Sale', sale.id, {
      invoice: sale.id,
      total,
      paymentMethod: input.paymentMethod,
      itemsCount: sale.items?.length || 0,
      customerId: sale.customerId,
    }, req.ip);

    return ok(res, sale, 201);
  } catch (err) {
    return handleError(res, err, 'createSale');
  }
}

export async function getSaleByIdHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const sale = await getSaleById(id);
    if (!sale) return fail(res, 'Venta no encontrada', 404);
    return ok(res, sale);
  } catch (err) {
    return handleError(res, err, 'getSaleById');
  }
}

export async function getAllSalesHandler(req: Request, res: Response) {
  try {
    const query = listSalesQuerySchema.parse(req.query);
    const callerId = req.user?.id ?? 'unknown';
    const isAdmin = (req.user as any)?.permissions?.includes('sales.admin') ?? false;
    const result = await getAllSales(query, callerId, isAdmin);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'getAllSales');
  }
}

export async function cancelSaleHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const input = cancelSaleSchema.parse(req.body);
    const userId = req.user?.id ?? 'unknown';
    const result = await cancelSale(id, input, userId);
    void logAction(userId, 'POS_SALE_CANCELLED', 'Sale', id, { reason: input.reason, saleId: result.saleId }, req.ip);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'cancelSale');
  }
}

export async function searchCustomersHandler(req: Request, res: Response) {
  try {
    const query = searchCustomersQuerySchema.parse(req.query);
    const result = await searchCustomers(query);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'searchCustomers');
  }
}

export async function previewTotals(req: Request, res: Response) {
  try {
    const { items, discountAmount, taxRate } = req.body as {
      items: Array<{ quantity: number; unitPrice: number; discountPerItem?: number }>;
      discountAmount?: number;
      taxRate?: number;
    };
    if (!Array.isArray(items) || items.length === 0) {
      return fail(res, 'Se requiere al menos un ítem para calcular totales', 400);
    }
    const totals = calculateSaleTotals(items, discountAmount, taxRate);
    return ok(res, totals);
  } catch (err) {
    return handleError(res, err, 'previewTotals');
  }
}

function extractId(param: string | string[]): string {
  return Array.isArray(param) ? param[0] : param;
}

export async function downloadInvoicePdf(req: Request, res: Response) {
  try {
    const saleId = extractId(req.params['id']);
    const sale = await getSaleById(saleId);
    if (!sale) return fail(res, 'Venta no encontrada', 404);

    const html = `<!DOCTYPE html>
<html>
<head><title>Factura ${sale.saleNumber}</title></head>
<body>
<h1>Factura de Venta: ${sale.saleNumber}</h1>
<p>Fecha: ${new Date(sale.createdAt).toLocaleDateString('es-CO')}</p>
<p>Cliente: ${sale.customers?.nameCommercial || 'Público General'}</p>
<p>Método de Pago: ${sale.paymentMethod}</p>
<p>Estado: ${sale.status}</p>
<p>Subtotal: $${Number(sale.subtotal).toLocaleString('es-CO')}</p>
<p>Descuento: $${Number(sale.discountAmount || 0).toLocaleString('es-CO')}</p>
<p>Impuestos: $${Number(sale.taxAmount || 0).toLocaleString('es-CO')}</p>
<p><strong>TOTAL: $${Number(sale.totalAmount).toLocaleString('es-CO')}</strong></p>
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.setHeader('Content-Disposition', `attachment; filename="Factura-${sale.saleNumber}.html"`);
    res.send(html);
    return;
  } catch (error: any) {
    logger.error('[posController] downloadInvoicePdf', { err: error, saleId: req.params.id });
    return fail(res, 'Error al generar factura: ' + error.message, 500);
  }
}

