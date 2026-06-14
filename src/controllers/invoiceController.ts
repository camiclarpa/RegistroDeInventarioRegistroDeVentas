/**
 * invoiceController.ts — Módulo 3: Facturación y Documentación Comercial
 */
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { companyConfigSchema, cancelSaleSchema } from '../utils/validators';
import {
  getCompanyConfig,
  updateCompanyConfig,
  generateInvoiceDocument,
  cancelInvoice,
} from '../services/invoiceService';
import { prisma } from '../config/prisma';
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
  logger.error(`[InvoiceController] ${context}`, { err });

  if (err instanceof ZodError) {
    return fail(res, 'Datos de entrada inválidos', 422, err.flatten());
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2025') return fail(res, 'Registro no encontrado', 404);
  }

  if (err instanceof Error) return fail(res, err.message, 400);
  return fail(res, 'Error interno del servidor', 500);
}

export async function listInvoicesHandler(req: Request, res: Response) {
  try {
    const page = Math.max(1, parseInt(String(req.query['page'] ?? '1')));
    const limit = Math.min(100, Math.max(1, parseInt(String(req.query['limit'] ?? '100'))));
    const startDate = req.query['startDate'] as string | undefined;
    const endDate = req.query['endDate'] as string | undefined;
    const customerId = req.query['customerId'] as string | undefined;
    const customerName = req.query['customerName'] as string | undefined;
    const customerIdentification = req.query['customerIdentification'] as string | undefined;
    const status = req.query['status'] as string | undefined;
    
    let dbStatus: string | undefined = undefined;
    if (status === 'EMITIDA') dbStatus = 'COMPLETED';
    else if (status === 'ANULADA') dbStatus = 'CANCELLED';

    const where: any = {};
    if (customerId && customerId !== '' && customerId !== 'undefined') where.customerId = customerId;
    if (dbStatus === 'COMPLETED' || dbStatus === 'CANCELLED' || dbStatus === 'REFUNDED') where.status = dbStatus;
    
    if (startDate) {
      const start = new Date(startDate);
      if (!isNaN(start.getTime())) where.createdAt = { ...where.createdAt, gte: start };
    }
    if (endDate) {
      const end = new Date(endDate);
      if (!isNaN(end.getTime())) {
        end.setHours(23, 59, 59, 999);
        where.createdAt = { ...where.createdAt, lte: end };
      }
    }

    if (customerName && customerName !== '' && customerIdentification && customerIdentification !== '') {
      where.AND = [
        {
          OR: [
            { customerName: { contains: customerName, mode: 'insensitive' } },
            { customers: { name: { contains: customerName, mode: 'insensitive' } } },
          ]
        },
        {
          OR: [
            { customerIdentification: { contains: customerIdentification, mode: 'insensitive' } },
            { customers: { identificationNumber: { contains: customerIdentification, mode: 'insensitive' } } },
          ]
        }
      ];
    } else if (customerName && customerName !== '') {
      where.OR = [
        { customerName: { contains: customerName, mode: 'insensitive' } },
        { customers: { name: { contains: customerName, mode: 'insensitive' } } },
      ];
    } else if (customerIdentification && customerIdentification !== '') {
      where.OR = [
        { customerIdentification: { contains: customerIdentification, mode: 'insensitive' } },
        { customers: { identificationNumber: { contains: customerIdentification, mode: 'insensitive' } } },
      ];
    }

    const sales = await prisma.sales.findMany({
      where,
      skip: (page - 1) * limit,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        customers: { select: { id: true, name: true, identificationNumber: true, phone: true, address: true } },
        sale_items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            productId: true,
            productNameSnapshot: true,
            skuSnapshot: true,
            lineTotal: true,
            discountPerItem: true
          }
        },
      },
    });

    const total = await prisma.sales.count({ where });

    const mappedInvoices = sales.map((sale: any) => {
      const statusMap: Record<string, string> = {
        'COMPLETED': 'EMITIDA',
        'CANCELLED': 'ANULADA',
        'REFUNDED': 'REEMBOLSADA'
      };
      const invoiceStatus = statusMap[sale.status] || 'PENDIENTE';
      const customer = sale.customers;
      const customerNameValue = customer?.name || sale.customerName || 'Consumidor Final';
      const customerIdentificationValue = customer?.identificationNumber || sale.customerIdentification || '';

      return {
        id: sale.id,
        invoiceNumber: sale.saleNumber,
        issuedAt: sale.createdAt,
        total: sale.totalAmount?.toString() ?? '0',
        status: invoiceStatus,
        customer,
        customerName: customerNameValue,
        customerIdentification: customerIdentificationValue,
        items: sale.sale_items,
        paymentMethod: sale.paymentMethod,
        notes: sale.notes,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt,
      };
    });

    return ok(res, {
      invoices: mappedInvoices,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (err) {
    return handleError(res, err, 'listInvoices');
  }
}

export function getCompanyConfigHandler(_req: Request, res: Response) {
  try {
    const config = getCompanyConfig();
    return ok(res, config);
  } catch (err) {
    return handleError(res, err, 'getCompanyConfig');
  }
}

export function updateCompanyConfigHandler(req: Request, res: Response) {
  try {
    const input = companyConfigSchema.parse(req.body);
    const result = updateCompanyConfig(input);
    const userId = req.user?.id ?? 'unknown';
    void logAction(userId, 'INVOICE_CONFIG_UPDATED', 'SystemConfig', 'company', { fields: Object.keys(input) }, req.ip);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'updateCompanyConfig');
  }
}

export async function getInvoiceHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const doc = await generateInvoiceDocument(id);
    if (!doc) return fail(res, `Factura no encontrada para el identificador "${id}"`, 404);
    return ok(res, doc);
  } catch (err) {
    return handleError(res, err, 'getInvoice');
  }
}

export async function cancelInvoiceHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const input = cancelSaleSchema.parse(req.body);
    const userId = req.user?.id ?? 'unknown';
    const result = await cancelInvoice(id, input, userId);
    void logAction(userId, 'INVOICE_CANCELLED', 'Sale', id, { reason: input.reason, invoiceNumber: result.saleNumber }, req.ip);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'cancelInvoice');
  }
}

