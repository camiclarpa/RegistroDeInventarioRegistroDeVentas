#!/bin/bash
# ============================================================
# SIGC-Motos — FIX COMPLETO MÓDULO DE COMPRAS
# Ejecutar en VPS: bash fix_compras.sh
# ============================================================
set -euo pipefail

cd /opt/SIGH_MOTOS

echo "========================================"
echo "  🔧 SIGC-Motos — Fix Módulo Compras"
echo "========================================"

# ── 1. BACKUP DE ARCHIVOS ACTUALES ────────────────────────────────────────
echo "[1/6] Creando backup de archivos actuales..."
mkdir -p /opt/SIGH_MOTOS/backup_$(date +%Y%m%d_%H%M%S)
cp src/utils/validators.ts backup_*/validators.ts.backup 2>/dev/null || true
cp src/controllers/purchaseController.ts backup_*/purchaseController.ts.backup 2>/dev/null || true
cp src/routes/index.ts backup_*/index.ts.backup 2>/dev/null || true
echo "  ✓ Backup creado"

# ── 2. ACTUALIZAR validators.ts ───────────────────────────────────────────
echo "[2/6] Actualizando src/utils/validators.ts..."
cat > src/utils/validators.ts << 'VALIDATORS_EOF'
import { z } from 'zod';
import { MovementType, PaymentMethod, SaleStatus, PurchaseOrderStatus } from '@prisma/client';

// ─── Helpers ──────────────────────────────────────────────────────────────

const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, {
    message: 'Debe ser un número positivo',
  });

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — INVENTARIO: MARCAS
// ═══════════════════════════════════════════════════════════════════════════

export const createBrandSchema = z.object({
  name: z.string().min(2).max(100),
  logoUrl: z.string().url({ message: 'URL de logo inválida' }).optional(),
  isActive: z.boolean().default(true),
});

export const updateBrandSchema = createBrandSchema.partial();

export const listBrandsQuerySchema = z.object({
  query: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — INVENTARIO: CATEGORÍAS
// ═══════════════════════════════════════════════════════════════════════════

export const createCategorySchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug: sólo minúsculas, números y guiones')
    .optional(),
  codePrefix: z
    .string()
    .min(2)
    .max(6)
    .regex(/^[A-Z0-9]+$/i, 'Prefijo: sólo letras y números')
    .transform((v) => v.toUpperCase()),
  marginPercentage: z.number().min(0).max(99.99).default(30),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  query: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — INVENTARIO: PRODUCTOS
// ═══════════════════════════════════════════════════════════════════════════

export const createProductSchema = z.object({
  skuInternal: z
    .string()
    .min(3, 'SKU mínimo 3 caracteres')
    .max(20, 'SKU máximo 20 caracteres')
    .regex(/^[A-Z0-9-]+$/i, 'SKU: solo letras, números y guiones (sin espacios)')
    .optional(),

  barcodeExternal: z.string().max(50).optional(),
  partNumberOEM:   z.string().min(1).max(100),

  brandId:    z.string().cuid({ message: 'brandId inválido' }),
  categoryId: z.string().cuid({ message: 'categoryId inválido' }),

  nameCommercial:  z.string().min(2, 'Nombre mínimo 2 caracteres').max(200),
  descriptionTech: z.string().max(2000).optional(),

  compatibleModels: z.array(z.string().min(1)).default([]),

  locationBin: z.string().min(1).max(50).default('SIN-UBICACION'),

  imageKey: z.string().max(500).optional(),

  costPriceAvg:  z.number().positive('El costo debe ser mayor a 0'),
  salePriceBase: z.number().positive('El precio de venta debe ser mayor a 0').optional(),
  taxRate: z.number().min(0).max(100).default(19),

  stockQuantity: z.number().int().min(0, 'El stock no puede ser negativo').default(0),
  minStockLevel: z.number().int().min(0).default(5),
  maxStockLevel: z.number().int().positive().optional(),

  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial().omit({
  skuInternal: true,
});

export const adjustStockSchema = z.object({
  quantity: z
    .number()
    .int()
    .refine((v) => v !== 0, { message: 'La cantidad no puede ser 0' }),

  type: z.enum(
    Object.values(MovementType) as [MovementType, ...MovementType[]],
    { error: `Tipo inválido. Valores: ${Object.values(MovementType).join(', ')}` },
  ),

  reason: z.string().min(3).max(500),
  referenceDoc: z.string().max(100).optional(),
});

export const patchStockSchema = z.object({
  quantity: z
    .number()
    .int()
    .refine((v) => v !== 0, { message: 'La cantidad no puede ser 0' }),
  reason:       z.string().min(3, 'Motivo mínimo 3 caracteres').max(500),
  referenceDoc: z.string().max(100).optional(),
  unitCost: z.number().positive('El costo unitario debe ser mayor a 0').optional(),
});

export const getProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  search: z.string().optional(),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  lowStock: z.string().optional().transform((v) => v === 'true'),
  minStock:  z.string().optional().transform((v) => v === 'true'),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  sortBy: z
    .string()
    .refine((v) => !v || /^\w+:(asc|desc)$/.test(v), 'Formato: campo:asc|desc')
    .optional()
    .default('createdAt:desc'),
  priceMin:   z.coerce.number().min(0).optional(),
  priceMax:   z.coerce.number().min(0).optional(),
  stockMin:   z.coerce.number().int().min(0).optional(),
  stockMax:   z.coerce.number().int().min(0).optional(),
  location:   z.string().optional(),
  startDate:  z.string().optional(),
  endDate:    z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 2 — VENTAS / POS
// ═══════════════════════════════════════════════════════════════════════════

export const barcodeSchema = z.object({
  code: z.string().min(1, 'El código de barras no puede estar vacío').max(100),
});

export const createCustomerSchema = z.object({
  name: z.string().min(2).max(200),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  identificationNumber: z.string().max(30).optional(),
  address: z.string().max(300).optional(),
});

export const updateCustomerSchema = createCustomerSchema.partial();

export const searchCustomersQuerySchema = z.object({
  query: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const saleItemSchema = z.object({
  productId: z.string().min(1, 'productId requerido'),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
  unitPrice: z.number().positive().optional(),
  discountPerItem: z.number().min(0).default(0),
});

export const createSaleSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.enum(
    Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]],
    { error: `Método de pago inválido. Valores: ${Object.values(PaymentMethod).join(', ')}` },
  ),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().max(1000).optional(),
  items: z.array(saleItemSchema).min(1, 'La venta debe tener al menos un ítem'),
});

export const listSalesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  customerId: z.string().optional(),
  status: z
    .enum(Object.values(SaleStatus) as [SaleStatus, ...SaleStatus[]])
    .optional(),
  paymentMethod: z
    .enum(Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]])
    .optional(),
  sortBy: z
    .string()
    .regex(/^\w+:(asc|desc)$/, 'Formato: campo:asc|desc')
    .optional()
    .default('createdAt:desc'),
});

export const cancelSaleSchema = z.object({
  reason: z.string().min(5).max(500),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 3 — COMPRAS Y PROVEEDORES
// ═══════════════════════════════════════════════════════════════════════════

export const createSupplierSchema = z.object({
  name: z.string().min(2).max(200),
  nit: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(300).optional(),
  contactPerson: z.string().max(150).optional(),
  paymentTerms: z.string().max(100).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const listSuppliersQuerySchema = z.object({
  query: z.string().optional(),
  isActive: z
    .string()
    .optional()
    .transform((v) => (v === undefined ? undefined : v === 'true')),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

const purchaseOrderItemSchema = z.object({
  productId: z.string().min(1, 'productId requerido'),
  quantityOrdered: z.number().int().positive('La cantidad debe ser mayor a 0').optional(),
  quantity: z.number().int().positive('La cantidad debe ser mayor a 0').optional(),
  unitCost: z.number().min(0, 'El costo no puede ser negativo'),
}).transform((d) => ({
  productId: d.productId,
  quantityOrdered: (d.quantityOrdered ?? d.quantity) as number,
  unitCost: d.unitCost,
})).refine((d) => d.quantityOrdered > 0, {
  message: 'La cantidad debe ser mayor a 0',
  path: ['quantityOrdered'],
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1, 'supplierId requerido'),
  expectedDate: z.string().optional(),
  notes: z.string().max(1000).optional(),
  items: z
    .array(purchaseOrderItemSchema)
    .min(1, 'La orden debe tener al menos un ítem'),
});

const receiveItemSchema = z.object({
  purchaseOrderItemId: z.string().min(1, 'purchaseOrderItemId requerido'),
  quantityReceived: z
    .number()
    .int()
    .positive('La cantidad recibida debe ser mayor a 0'),
});

export const receivePurchaseOrderSchema = z.object({
  items: z
    .array(receiveItemSchema)
    .min(1, 'Debe recibir al menos un ítem'),
});

const PURCHASE_STATUS_ALIAS: Record<string, PurchaseOrderStatus> = {
  PENDIENTE: PurchaseOrderStatus.PENDING,
  RECIBIDA:  PurchaseOrderStatus.RECEIVED,
  CANCELADA: PurchaseOrderStatus.CANCELLED,
  PARCIAL:   PurchaseOrderStatus.PARTIALLY_RECEIVED,
};

export const listPurchaseOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  supplierId: z.string().optional(),
  status: z.string().optional().transform((v) => {
    if (!v) return undefined;
    return PURCHASE_STATUS_ALIAS[v] ??
      (Object.values(PurchaseOrderStatus).includes(v as PurchaseOrderStatus)
        ? (v as PurchaseOrderStatus)
        : undefined);
  }),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  sortBy: z
    .string()
    .regex(/^\w+:(asc|desc)$/, 'Formato: campo:asc|desc')
    .optional()
    .default('createdAt:desc'),
});

export const cancelPurchaseOrderSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 4 — ENTRADAS DE MERCANCÍA (Recepción Física)
// ═══════════════════════════════════════════════════════════════════════════

export const entryItemSchema = z.object({
  productId:       z.string().min(1).optional(),
  skuInternal:     z.string().min(3).max(20).optional(),
  barcodeExternal: z.string().max(50).optional(),

  nameCommercial: z.string().min(2).max(200).optional(),
  brandId:        z.string().min(1).optional(),
  categoryId:     z.string().min(1).optional(),
  partNumberOEM:  z.string().min(1).max(100).optional(),

  quantity: z.number().int().positive('La cantidad debe ser mayor a 0'),
  unitCost: z.number().positive('El costo unitario debe ser mayor a 0'),
  notes:    z.string().max(500).optional(),
}).refine(
  (d) => !!(d.productId || d.skuInternal || d.barcodeExternal || (d.nameCommercial && d.brandId && d.categoryId)),
  {
    message:
      'Proporcionar productId, skuInternal o barcodeExternal para un producto existente; ' +
      'o bien nameCommercial + brandId + categoryId para crear uno nuevo.',
  },
);

export const registerEntrySchema = z.object({
  items: z.array(entryItemSchema).min(1, 'La entrada debe incluir al menos un ítem'),
  notes: z.string().max(1000).optional(),
});

export const listEntriesQuerySchema = z.object({
  page:      z.coerce.number().int().positive().default(1),
  limit:     z.coerce.number().int().min(1).max(100).default(20),
  startDate: z.string().datetime().optional(),
  endDate:   z.string().datetime().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 7 — SEGURIDAD Y GOBERNANZA DE ACCESO
// ═══════════════════════════════════════════════════════════════════════════

export const loginSchema = z.object({
  email:    z.string().email({ message: 'Email con formato inválido' }).toLowerCase().trim(),
  password: z.string().min(8, 'La contraseña debe tener al menos 8 caracteres'),
});

export const registerSchema = z.object({
  name:     z.string().min(2, 'Nombre mínimo 2 caracteres').max(150),
  email:    z.string().email({ message: 'Email con formato inválido' }).toLowerCase().trim(),
  password: z
    .string()
    .min(8, 'Mínimo 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número'),
  roleId:   z.string().min(1, 'roleId requerido'),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1, 'La contraseña actual es requerida'),
  newPassword: z
    .string()
    .min(8, 'La nueva contraseña debe tener al menos 8 caracteres')
    .regex(/[A-Z]/, 'Debe incluir al menos una mayúscula')
    .regex(/[0-9]/, 'Debe incluir al menos un número'),
}).refine(
  data => data.oldPassword !== data.newPassword,
  { message: 'La nueva contraseña debe ser diferente a la actual', path: ['newPassword'] },
);

export const auditLogsQuerySchema = z.object({
  cursor:  z.string().optional(),
  limit:   z.coerce.number().int().min(1).max(200).default(50),
  userId:  z.string().optional(),
  entity:  z.string().optional(),
  action:  z.string().optional(),
  from:    z.string().optional(),
  to:      z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 6 — INTELIGENCIA DE NEGOCIOS (REPORTES)
// ═══════════════════════════════════════════════════════════════════════════

export const dateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate:   z.string().optional(),
});

export const exportTypeSchema = z.enum(['sales', 'inventory', 'products'], {
  error: 'Tipo de exportación inválido. Valores: sales, inventory, products',
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 5 — TESORERÍA Y CONTROL DE CAJA
// ═══════════════════════════════════════════════════════════════════════════

export const openCashShiftSchema = z.object({
  initialBalance: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
      { message: 'initialBalance debe ser un número mayor o igual a cero' },
    ),
  notes: z.string().max(500).optional(),
});

export const registerExpenseSchema = z.object({
  amount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
      { message: 'amount debe ser mayor a cero' },
    ),
  description:   z.string().min(3, 'Descripción mínimo 3 caracteres').max(500),
  category:      z.string().min(2, 'Categoría requerida').max(100),
  paymentMethod: z.enum(
    Object.values(PaymentMethod) as [PaymentMethod, ...PaymentMethod[]],
    { error: `paymentMethod inválido. Valores: ${Object.values(PaymentMethod).join(', ')}` },
  ),
});

export const closeCashShiftSchema = z.object({
  physicalCount: z
    .union([z.string(), z.number()])
    .transform((v) => String(v))
    .refine(
      (v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0,
      { message: 'physicalCount debe ser un número mayor o igual a cero' },
    ),
  observations: z.string().max(1000).optional(),
});

export const dailySummaryQuerySchema = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Fecha debe estar en formato YYYY-MM-DD')
    .optional(),
  userId: z.string().min(1).optional(),
});

export const denominationItemSchema = z.object({
  denom: z.number().positive('La denominación debe ser positiva'),
  qty:   z.number().int().min(0, 'La cantidad debe ser ≥ 0'),
});

export const createCashCountSchema = z.object({
  cashRegisterId: z.string().min(1, 'ID de caja requerido'),
  denominations:  z.array(denominationItemSchema).min(1, 'Al menos una denominación'),
  type:           z.enum(['OPENING', 'CLOSING', 'SURPRISE', 'MIDDAY']).optional(),
  isBlindCount:   z.boolean().optional(),
  observations:   z.string().max(1000).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 3 — FACTURACIÓN Y DOCUMENTACIÓN COMERCIAL
// ═══════════════════════════════════════════════════════════════════════════

export const companyConfigSchema = z.object({
  name:    z.string().min(2).max(200).optional(),
  nit:     z.string().min(5).max(30).optional(),
  address: z.string().min(5).max(300).optional(),
  phone:   z.string().min(5).max(30).optional(),
  email:   z.string().email({ message: 'Email inválido' }).optional().or(z.literal('')),
  footer:  z.string().max(500).optional(),
});

// ─── Tipos exportados ──────────────────────────────────────────────────────

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type ListBrandsQuery = z.infer<typeof listBrandsQuerySchema>;

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;

export type CreateProductInput  = z.infer<typeof createProductSchema>;
export type UpdateProductInput  = z.infer<typeof updateProductSchema>;
export type AdjustStockInput    = z.infer<typeof adjustStockSchema>;
export type PatchStockInput     = z.infer<typeof patchStockSchema>;
export type GetProductsQuery    = z.infer<typeof getProductsQuerySchema>;

export type BarcodeInput       = z.infer<typeof barcodeSchema>;
export type CreateCustomerInput  = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput  = z.infer<typeof updateCustomerSchema>;
export type SearchCustomersQuery = z.infer<typeof searchCustomersQuerySchema>;
export type CreateSaleInput    = z.infer<typeof createSaleSchema>;
export type ListSalesQuery     = z.infer<typeof listSalesQuerySchema>;
export type CancelSaleInput    = z.infer<typeof cancelSaleSchema>;

export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>;
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;

export type EntryItemInput      = z.infer<typeof entryItemSchema>;
export type RegisterEntryInput  = z.infer<typeof registerEntrySchema>;
export type ListEntriesQuery    = z.infer<typeof listEntriesQuerySchema>;

export type CompanyConfigInput = z.infer<typeof companyConfigSchema>;

export type LoginInput            = z.infer<typeof loginSchema>;
export type RegisterInput         = z.infer<typeof registerSchema>;
export type ChangePasswordInput   = z.infer<typeof changePasswordSchema>;
export type AuditLogsQuery        = z.infer<typeof auditLogsQuerySchema>;

export type DateRangeQuery        = z.infer<typeof dateRangeQuerySchema>;
export type ExportType            = z.infer<typeof exportTypeSchema>;

export type OpenCashShiftInput    = z.infer<typeof openCashShiftSchema>;
export type RegisterExpenseInput  = z.infer<typeof registerExpenseSchema>;
export type CloseCashShiftInput   = z.infer<typeof closeCashShiftSchema>;
export type DailySummaryQuery     = z.infer<typeof dailySummaryQuerySchema>;
export type DenominationItemInput = z.infer<typeof denominationItemSchema>;
export type CreateCashCountInput  = z.infer<typeof createCashCountSchema>;
VALIDATORS_EOF

echo "  ✓ validators.ts actualizado"

# ── 3. ACTUALIZAR purchaseController.ts ─────────────────────────────────────
echo "[3/6] Actualizando src/controllers/purchaseController.ts..."
cat > src/controllers/purchaseController.ts << 'CONTROLLER_EOF'
import { Request, Response } from 'express';
import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import {
  createSupplierSchema,
  updateSupplierSchema,
  listSuppliersQuerySchema,
  createPurchaseOrderSchema,
  receivePurchaseOrderSchema,
  listPurchaseOrdersQuerySchema,
  cancelPurchaseOrderSchema,
  registerEntrySchema,
  listEntriesQuerySchema,
} from '../utils/validators';
import {
  createSupplier,
  getSuppliers,
  getSupplierById,
  updateSupplier,
} from '../services/supplierService';
import {
  createPurchaseOrder,
  receivePurchaseOrder,
  cancelPurchaseOrder,
  getPurchaseOrderById,
  getPurchaseOrders,
  OverreceiptError,
} from '../services/purchaseOrderService';
import {
  processEntryTransaction,
  getAllEntries,
  getEntryById,
} from '../services/purchaseService';
import { createPayableFromPurchase } from '../services/debtService';
import { logAction } from '../services/auditService';
import { logger } from '../config/logger';

// ─── Helpers ────────────────────────────────────────────────────────────────

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

const fail = (res: Response, error: string, status = 400, details?: unknown) =>
  res.status(status).json({ success: false, error, ...(details ? { details } : {}) });

// Mapeo de estados Prisma (inglés) → nombres que espera el frontend (español)
const STATUS_TO_SPANISH: Record<string, string> = {
  PENDING:            'PENDIENTE',
  RECEIVED:           'RECIBIDA',
  CANCELLED:          'CANCELADA',
  PARTIALLY_RECEIVED: 'PARCIAL',
};

// Serializa una PurchaseOrder de Prisma al formato que consume el frontend
function serializePurchaseOrder(po: Record<string, unknown>): Record<string, unknown> {
  const rawItems = Array.isArray(po['items']) ? (po['items'] as Record<string, unknown>[]) : [];
  const items = rawItems.map((item) => {
    const product = item['product'] as Record<string, unknown> | undefined;
    return {
      ...item,
      quantity:   item['quantityOrdered'],
      subtotal:   item['lineTotal'],
      product: product
        ? { ...product, name: product['nameCommercial'] ?? product['name'] }
        : { name: item['productNameSnapshot'] },
    };
  });
  return {
    ...po,
    total:  po['totalAmount'],
    status: STATUS_TO_SPANISH[po['status'] as string] ?? po['status'],
    items,
  };
}

function extractParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

function handleError(res: Response, err: unknown, context: string) {
  logger.error(`[PurchaseController] ${context}`, { err });

  if (err instanceof ZodError) {
    return fail(res, 'Datos de entrada inválidos', 422, err.flatten());
  }

  if (err instanceof OverreceiptError) {
    return fail(res, err.message, 400, {
      type: 'OVERRECEIPT',
      product: err.productName,
      pending: err.pending,
      attempted: err.attempted,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      const fields = (err.meta?.target as string[] | undefined)?.join(', ') ?? 'campo';
      return fail(res, `Ya existe un registro con ese ${fields}`, 409);
    }
    if (err.code === 'P2025') {
      return fail(res, 'Registro no encontrado', 404);
    }
  }

  if (err instanceof Error) {
    return fail(res, err.message, 400);
  }

  return fail(res, 'Error interno del servidor', 500);
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVEEDORES
// ═══════════════════════════════════════════════════════════════════════════

export async function createSupplierHandler(req: Request, res: Response) {
  try {
    const body = { ...(req.body as Record<string, unknown>) };
    if (!body['contactPerson'] && body['contactName']) {
      body['contactPerson'] = body['contactName'];
    }
    const input = createSupplierSchema.parse(body);
    const supplier = await createSupplier(input);
    return ok(res, supplier, 201);
  } catch (err) {
    return handleError(res, err, 'createSupplier');
  }
}

export async function listSuppliersHandler(req: Request, res: Response) {
  try {
    const query = listSuppliersQuerySchema.parse(req.query);
    const result = await getSuppliers(query);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'listSuppliers');
  }
}

export async function getSupplierByIdHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const supplier = await getSupplierById(id);
    if (!supplier) return fail(res, 'Proveedor no encontrado', 404);
    return ok(res, supplier);
  } catch (err) {
    return handleError(res, err, 'getSupplierById');
  }
}

export async function updateSupplierHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const body = { ...(req.body as Record<string, unknown>) };
    if (!body['contactPerson'] && body['contactName']) {
      body['contactPerson'] = body['contactName'];
    }
    const input = updateSupplierSchema.parse(body);
    const supplier = await updateSupplier(id, input);
    return ok(res, supplier);
  } catch (err) {
    return handleError(res, err, 'updateSupplier');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// ÓRDENES DE COMPRA
// ═══════════════════════════════════════════════════════════════════════════

export async function createPurchaseOrderHandler(req: Request, res: Response) {
  try {
    const input = createPurchaseOrderSchema.parse(req.body);
    const userId = req.user?.id ?? 'unknown';
    const po = await createPurchaseOrder(input, userId);
    return ok(res, serializePurchaseOrder(po as unknown as Record<string, unknown>), 201);
  } catch (err) {
    return handleError(res, err, 'createPurchaseOrder');
  }
}

export async function receivePurchaseOrderHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const userId = req.user?.id ?? 'unknown';
    const body = req.body as Record<string, unknown>;

    let receiveItems: Array<{ purchaseOrderItemId: string; quantityReceived: number }>;

    if (Array.isArray(body['items']) && (body['items'] as unknown[]).length > 0) {
      const input = receivePurchaseOrderSchema.parse(req.body);
      receiveItems = input.items;
    } else {
      const order = await getPurchaseOrderById(id);
      if (!order) return fail(res, 'Orden de compra no encontrada', 404);
      receiveItems = (order.items as Array<{ id: string; quantityOrdered: number; quantityReceived: number }>)
        .filter((item) => item.quantityOrdered > item.quantityReceived)
        .map((item) => ({
          purchaseOrderItemId: item.id,
          quantityReceived:    item.quantityOrdered - item.quantityReceived,
        }));
      if (receiveItems.length === 0) {
        return fail(res, 'No hay ítems pendientes de recepción en esta orden', 400);
      }
    }

    const po = await receivePurchaseOrder(id, { items: receiveItems }, userId);

    if (body['isCredit'] === true && po.status !== 'CANCELLED') {
      const dueDate = typeof body['dueDate'] === 'string' ? new Date(body['dueDate']) : undefined;
      void createPayableFromPurchase(
        po.id, po.supplierId, parseFloat(String(po.totalAmount)), dueDate,
      ).catch((err: unknown) => logger.error('[purchaseController] Error al crear CxP', err));
    }

    return ok(res, serializePurchaseOrder(po as unknown as Record<string, unknown>));
  } catch (err) {
    return handleError(res, err, 'receivePurchaseOrder');
  }
}

export async function cancelPurchaseOrderHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const input = cancelPurchaseOrderSchema.parse(req.body);
    const userId = req.user?.id ?? 'unknown';
    const po = await cancelPurchaseOrder(id, input, userId);
    return ok(res, po);
  } catch (err) {
    return handleError(res, err, 'cancelPurchaseOrder');
  }
}

export async function getPurchaseOrderByIdHandler(req: Request, res: Response) {
  try {
    const id = extractParam(req.params['id']);
    const po = await getPurchaseOrderById(id);
    if (!po) return fail(res, 'Orden de compra no encontrada', 404);
    return ok(res, serializePurchaseOrder(po as unknown as Record<string, unknown>));
  } catch (err) {
    return handleError(res, err, 'getPurchaseOrderById');
  }
}

export async function listPurchaseOrdersHandler(req: Request, res: Response) {
  try {
    const query = listPurchaseOrdersQuerySchema.parse(req.query);
    const result = await getPurchaseOrders(query);
    return ok(res, {
      data: result.data.map((po) => serializePurchaseOrder(po as unknown as Record<string, unknown>)),
      meta: result.meta,
    });
  } catch (err) {
    return handleError(res, err, 'listPurchaseOrders');
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 4 — ENTRADAS DE MERCANCÍA (Recepción Física)
// ═══════════════════════════════════════════════════════════════════════════

export async function registerEntryHandler(req: Request, res: Response) {
  try {
    const input  = registerEntrySchema.parse(req.body);
    const userId = req.user?.id ?? 'unknown';

    const result = await processEntryTransaction(input, userId);

    void logAction(userId, 'PURCHASE_ENTRY_REGISTERED', 'InventoryMovement', result.entryNumber, {
      entryNumber:    result.entryNumber,
      itemsProcessed: result.itemsProcessed,
      totalValue:     result.totalValue,
      newProducts:    result.items.filter((i) => i.wasCreated).length,
    }, req.ip);

    return ok(res, result, 201);
  } catch (err) {
    return handleError(res, err, 'registerEntry');
  }
}

export async function getAllEntriesHandler(req: Request, res: Response) {
  try {
    const query  = listEntriesQuerySchema.parse(req.query);
    const result = await getAllEntries(query);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'getAllEntries');
  }
}

export async function getEntryByIdHandler(req: Request, res: Response) {
  try {
    const entryNumber = extractParam(req.params['id']);
    const entry       = await getEntryById(entryNumber);

    if (!entry) {
      return fail(res, `Entrada "${entryNumber}" no encontrada`, 404);
    }

    return ok(res, entry);
  } catch (err) {
    return handleError(res, err, 'getEntryById');
  }
}
CONTROLLER_EOF

echo "  ✓ purchaseController.ts actualizado"

# ── 4. ACTUALIZAR index.ts (rutas) ──────────────────────────────────────────
echo "[4/6] Actualizando src/routes/index.ts..."
cat > src/routes/index.ts << 'ROUTES_EOF'
import { Router } from 'express';
import inventoryRoutes     from './inventoryRoutes';
import productRoutes       from './productRoutes';
import posRoutes           from './posRoutes';
import salesRoutes         from './salesRoutes';
import customerRoutes      from './customerRoutes';
import purchaseRoutes      from './purchaseRoutes';
import purchaseOrderRoutes from './purchaseOrderRoutes';
import supplierRoutes      from './supplierRoutes';
import reportRoutes        from './reportRoutes';
import authRoutes          from './authRoutes';
import userRoutes          from './userRoutes';
import financeRoutes       from './financeRoutes';
import invoiceRoutes       from './invoiceRoutes';
import treasuryRoutes      from './treasuryRoutes';
import securityRoutes      from './securityRoutes';
import imageRoutes         from './imageRoutes';
import debtRoutes          from './debtRoutes';
import abcRoutes           from './abcRoutes';
import posSearchRoutes     from './posSearchRoutes';
import configRoutes        from './configRoutes';
import crmRoutes           from './crmRoutes';
import crmExtendedRoutes   from './crmExtendedRoutes';
import adminRoutes         from './adminRoutes';
import { authenticate }    from '../middleware/authMiddleware';

const router = Router();

router.use('/auth',      authRoutes);
router.use('/users',     authenticate, userRoutes);
router.use('/inventory', inventoryRoutes);
router.use('/products',  productRoutes);
router.use('/pos',       posRoutes);
router.use('/sales',     salesRoutes);
router.use('/customers', customerRoutes);

// Módulo 4 — Entradas de Mercancía (ANTES de purchaseOrderRoutes)
router.use('/purchases/entries', purchaseRoutes);

// Módulo 3 — Compras y Proveedores
router.use('/purchases/orders', purchaseOrderRoutes);
router.use('/purchases/suppliers', supplierRoutes);

// Fallback genérico (DESPUÉS de las específicas)
router.use('/purchases', purchaseRoutes);
router.use('/suppliers', supplierRoutes);

router.use('/reports',   reportRoutes);
router.use('/reports',   abcRoutes);
router.use('/invoices',  invoiceRoutes);
router.use('/finance',   authenticate, financeRoutes);
router.use('/treasury',  authenticate, treasuryRoutes);
router.use('/treasury/debts', debtRoutes);
router.use('/security',  authenticate, securityRoutes);
router.use('/pos',       posSearchRoutes);
router.use('/crm', crmRoutes);
router.use('/crm/extended', crmExtendedRoutes);
router.use('/admin', adminRoutes);
router.use('/config', configRoutes);
router.use('/inventory', imageRoutes);

export default router;
ROUTES_EOF

echo "  ✓ index.ts actualizado"

# ── 5. RECONSTRUIR Y REINICIAR BACKEND ─────────────────────────────────────
echo "[5/6] Reconstruyendo contenedor del backend..."
docker compose build app --no-cache
docker compose up -d --no-deps app
echo "  ✓ Backend reconstruido y reiniciado"

# ── 6. ESPERAR Y VERIFICAR ─────────────────────────────────────────────────
echo "[6/6] Esperando que el backend esté healthy..."
attempt=0
until docker exec sigc_app wget -qO- http://localhost:3000/health 2>/dev/null | grep -q '"status"' || [ $attempt -ge 20 ]; do
  attempt=$((attempt + 1))
  echo "  ... intento $attempt/20"
  sleep 3
done

if [ $attempt -ge 20 ]; then
  echo "  ⚠️  Backend tardó demasiado. Revisando logs..."
  docker logs --tail=30 sigc_app
  exit 1
fi

echo "  ✓ Backend healthy"

# ── VERIFICACIÓN FINAL ─────────────────────────────────────────────────────
echo ""
echo "========================================"
echo "  🔍 Verificando endpoints..."
echo "========================================"

TOKEN=$(docker exec sigc_app wget -qO- --header='Content-Type: application/json' \
  --post-data='{"email":"admin@motos.quantacloud.co","password":"Admin123!"}' \
  http://localhost:3000/api/v1/auth/login 2>/dev/null | grep -o '"token":"[^"]*"' | cut -d'"' -f4 || echo "")

if [ -z "$TOKEN" ]; then
  echo "  ⚠️  No se pudo obtener token automáticamente"
  echo "  Prueba manual: curl -X POST http://localhost:3000/api/v1/auth/login ..."
else
  echo ""
  echo "  GET /api/v1/purchases/suppliers"
  docker exec sigc_app curl -s -o /dev/null -w "  → HTTP %{http_code}\n" \
    http://localhost:3000/api/v1/purchases/suppliers \
    -H "Authorization: Bearer $TOKEN"

  echo "  GET /api/v1/purchases/orders"
  docker exec sigc_app curl -s -o /dev/null -w "  → HTTP %{http_code}\n" \
    http://localhost:3000/api/v1/purchases/orders \
    -H "Authorization: Bearer $TOKEN"

  echo "  GET /api/v1/inventory/products"
  docker exec sigc_app curl -s -o /dev/null -w "  → HTTP %{http_code}\n" \
    http://localhost:3000/api/v1/inventory/products \
    -H "Authorization: Bearer $TOKEN"

  echo "  GET /api/v1/inventory/categories"
  docker exec sigc_app curl -s -o /dev/null -w "  → HTTP %{http_code}\n" \
    http://localhost:3000/api/v1/inventory/categories \
    -H "Authorization: Bearer $TOKEN"

  echo "  GET /api/v1/inventory/brands"
  docker exec sigc_app curl -s -o /dev/null -w "  → HTTP %{http_code}\n" \
    http://localhost:3000/api/v1/inventory/brands \
    -H "Authorization: Bearer $TOKEN"
fi

echo ""
echo "========================================"
echo "  ✅ FIX COMPLETADO"
echo "========================================"
echo "  Todos los endpoints deben retornar HTTP 200"
echo "  Accede a: https://motos.quantacloud.co/purchases"
echo "  Presiona Ctrl+F5 en el navegador para limpiar caché"
echo "========================================"
