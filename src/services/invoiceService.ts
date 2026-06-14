/**
 * invoiceService.ts — Módulo 3: Facturación y Documentación Comercial
 */
import fs from 'fs';
import path from 'path';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import type { CompanyConfigInput } from '../utils/validators';

export interface CompanyConfig {
  name: string;
  nit: string;
  address: string;
  phone: string;
  email?: string;
  footer?: string;
  logoKey?: string;
  taxRate?: number;
}

const CONFIG_PATH = path.join(__dirname, '../config/companyConfig.json');

const DEFAULT_CONFIG: CompanyConfig = {
  name: 'CLAVIJOS MOTOS S.A.S.',
  nit: '900.XXX.XXX-X',
  address: 'CRA 16 6-40 AGUACHICA CESAR',
  phone: '3117379097',
  footer: '¡Gracias por su compra! Garantía según política de fábrica.',
  taxRate: 19,
};

let _configCache: CompanyConfig | null = null;

export function getCompanyConfig(): CompanyConfig {
  if (_configCache) return _configCache;
  try {
    const raw = fs.readFileSync(CONFIG_PATH, 'utf-8');
    _configCache = JSON.parse(raw) as CompanyConfig;
    return _configCache;
  } catch {
    logger.warn('[invoiceService] companyConfig.json no encontrado o corrupto — usando defaults');
    _configCache = { ...DEFAULT_CONFIG };
    return _configCache;
  }
}

export function updateCompanyConfig(data: Partial<CompanyConfigInput>): CompanyConfig {
  const current = getCompanyConfig();
  const updated: CompanyConfig = { ...current, ...data };
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(updated, null, 2), 'utf-8');
  _configCache = updated;
  logger.info('[invoiceService] Company config updated', { fields: Object.keys(data) });
  return updated;
}

export interface InvoiceDocument {
  header: {
    company: string;
    nit: string;
    address: string;
    phone: string;
    email?: string;
    printedAt: string;
  };
  invoice: {
    number: string;
    date: string;
    cashierId: string;
    paymentMethod: string;
    status: string;
    notes: string | null;
    customerName: string | null;
    customerIdentification: string | null;
    cashReceived: number | null;
    changeAmount: number | null;
  };
  customer: {
    id: string;
    name: string;
    identification: string | null;
    phone: string | null;
    address: string | null;
  } | null;
  items: Array<{
    sku: string;
    name: string;
    qty: number;
    unitPrice: number;
    discount: number;
    lineTotal: number;
  }>;
  totals: {
    subtotal: number;
    discount: number;
    taxableBase: number;
    taxAmount: number;
    total: number;
  };
  footer: {
    message: string;
  };
}

export async function generateInvoiceDocument(identifier: string): Promise<InvoiceDocument | null> {
  const sale = await prisma.sales.findFirst({
    where: {
      OR: [{ id: identifier }, { saleNumber: identifier }],
    },
    include: {
      customers: {
        select: {
          id: true,
          name: true,
          identificationNumber: true,
          phone: true,
          address: true,
        },
      },
      sale_items: {
        select: {
          productNameSnapshot: true,
          skuSnapshot: true,
          quantity: true,
          unitPrice: true,
          discountPerItem: true,
          lineTotal: true,
        },
      },
    },
  });

  if (!sale) return null;

  const config = getCompanyConfig();
  const subtotal = Number(sale.subtotal);
  const discount = Number(sale.discountAmount);
  const taxAmount = Number(sale.taxAmount);
  const total = Number(sale.totalAmount);
  const taxableBase = Math.max(0, subtotal - discount);

  return {
    header: {
      company: config.name,
      nit: config.nit,
      address: config.address,
      phone: config.phone,
      ...(config.email && { email: config.email }),
      printedAt: new Date().toISOString(),
    },
    invoice: {
      number: sale.saleNumber,
      date: sale.createdAt.toISOString(),
      cashierId: sale.userId,
      paymentMethod: sale.paymentMethod,
      status: sale.status,
      notes: sale.notes ?? null,
      customerName: sale.customerName ?? null,
      customerIdentification: sale.customerIdentification ?? null,
      cashReceived: sale.cashReceived ? Number(sale.cashReceived) : null,
      changeAmount: sale.changeAmount ? Number(sale.changeAmount) : null,
    },
    customer: sale.customers
      ? {
          id: sale.customers.id,
          name: sale.customers.name,
          identification: sale.customers.identificationNumber ?? null,
          phone: sale.customers.phone ?? null,
          address: sale.customers.address ?? null,
        }
      : sale.customerName
        ? {
            id: 'consumidor-final',
            name: sale.customerName,
            identification: sale.customerIdentification ?? null,
            phone: null,
            address: null,
          }
        : null,
    items: sale.sale_items.map((item) => ({
      sku: item.skuSnapshot,
      name: item.productNameSnapshot,
      qty: item.quantity,
      unitPrice: Number(item.unitPrice),
      discount: Number(item.discountPerItem),
      lineTotal: Number(item.lineTotal),
    })),
    totals: {
      subtotal,
      discount,
      taxableBase,
      taxAmount,
      total,
    },
    footer: {
      message: config.footer ?? '¡Gracias por su compra!',
    },
  };
}

export { cancelSale as cancelInvoice } from './posService';

