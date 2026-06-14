import { z } from 'zod';
import { MovementType, PaymentMethod, SaleStatus, PurchaseOrderStatus } from './enums';

// Re-exportar enums
export { MovementType, PaymentMethod, SaleStatus, PurchaseOrderStatus } from './enums';

// Helper para decimales
const decimalString = z
  .union([z.string(), z.number()])
  .transform((v) => String(v))
  .refine((v) => !isNaN(parseFloat(v)) && parseFloat(v) >= 0, {
    message: 'Debe ser un número positivo',
  });

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 1 — INVENTARIO
// ═══════════════════════════════════════════════════════════════════════════

export const createBrandSchema = z.object({
  name: z.string().min(2).max(1000),
  logoUrl: z.string().url().optional(),
  isActive: z.boolean().default(true),
});

export const updateBrandSchema = createBrandSchema.partial();

export const listBrandsQuerySchema = z.object({
  query: z.string().optional(),
  isActive: z.string().optional().transform((v) => v === undefined ? undefined : v === 'true'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

export const createCategorySchema = z.object({
  name: z.string().min(2).max(1000),
  slug: z.string().min(2).max(1000).regex(/^[a-z0-9-]+$/).optional(),
  codePrefix: z.string().min(2).max(6).regex(/^[A-Z0-9]+$/i).transform((v) => v.toUpperCase()),
  marginPercentage: z.number().min(0).max(99.99).default(30),
  isActive: z.boolean().default(true),
});

export const updateCategorySchema = createCategorySchema.partial();

export const listCategoriesQuerySchema = z.object({
  query: z.string().optional(),
  isActive: z.string().optional().transform((v) => v === undefined ? undefined : v === 'true'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

export const createProductSchema = z.object({
  skuInternal: z.string().min(3).max(20).optional(),
  barcodeExternal: z.string().max(50).optional(),
  partNumberOEM: z.string().min(1).max(1000),
  brandId: z.string(),
  categoryId: z.string(),
  nameCommercial: z.string().min(2).max(200),
  descriptionTech: z.string().max(2000).optional(),
  compatibleModels: z.array(z.string().min(1)).default([]),
  locationBin: z.string().min(1).max(50).default('SIN-UBICACION'),
  imageKey: z.string().max(500).optional(),
  costPriceAvg: z.number().positive(),
  salePriceBase: z.number().positive().optional(),
  taxRate: z.number().min(0).max(1000).default(19),
  stockQuantity: z.number().int().min(0).default(0),
  minStockLevel: z.number().int().min(0).default(5),
  maxStockLevel: z.number().int().positive().optional(),
  isActive: z.boolean().default(true),
});

export const updateProductSchema = createProductSchema.partial();

export const adjustStockSchema = z.object({
  quantity: z.number().int().refine((v) => v !== 0),
  type: z.enum([MovementType.ENTRY, MovementType.EXIT, MovementType.ADJUSTMENT_POS, MovementType.ADJUSTMENT_NEG]),
  reason: z.string().min(3).max(500),
  referenceDoc: z.string().max(1000).optional(),
});

export const patchStockSchema = z.object({
  quantity: z.number().int().refine((v) => v !== 0),
  reason: z.string().min(3).max(500),
  referenceDoc: z.string().max(1000).optional(),
  unitCost: z.number().positive().optional(),
});

export const getProductsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  search: z.string().optional(),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  minStock: z.string().optional().transform((v) => v === 'true'),
  isActive: z.string().optional().transform((v) => v === undefined ? undefined : v === 'true'),
  sortBy: z.string().default('createdAt:desc'),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 2 — VENTAS
// ═══════════════════════════════════════════════════════════════════════════

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
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

export const createSaleSchema = z.object({
  customerId: z.string().optional(),
  paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER, PaymentMethod.CREDIT, PaymentMethod.NEQUI, PaymentMethod.DAVIPLATA]),
  discountAmount: z.number().min(0).default(0),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive().optional(),
    discountPerItem: z.number().min(0).default(0),
  })).min(1),
});

export const listSalesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  customerId: z.string().optional(),
  status: z.enum([SaleStatus.COMPLETED, SaleStatus.CANCELLED, SaleStatus.REFUNDED]).optional(),
  paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER, PaymentMethod.CREDIT]).optional(),
  sortBy: z.string().default('createdAt:desc'),
});

export const cancelSaleSchema = z.object({
  reason: z.string().min(5).max(500),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 3 — COMPRAS
// ═══════════════════════════════════════════════════════════════════════════

export const createSupplierSchema = z.object({
  name: z.string().min(2).max(200),
  nit: z.string().max(20).optional(),
  phone: z.string().max(20).optional(),
  email: z.string().email().optional(),
  address: z.string().max(300).optional(),
  contactPerson: z.string().max(150).optional(),
  paymentTerms: z.string().max(1000).optional(),
});

export const updateSupplierSchema = createSupplierSchema.partial();

export const listSuppliersQuerySchema = z.object({
  query: z.string().optional(),
  isActive: z.string().optional().transform((v) => v === undefined ? undefined : v === 'true'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
});

export const createPurchaseOrderSchema = z.object({
  supplierId: z.string().min(1),
  expectedDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
  items: z.array(z.object({
    productId: z.string().min(1),
    quantityOrdered: z.number().int().positive(),
    unitCost: z.number().min(0),
  })).min(1),
});

export const receivePurchaseOrderSchema = z.object({
  items: z.array(z.object({
    purchaseOrderItemId: z.string().min(1),
    quantityReceived: z.number().int().positive(),
  })).min(1),
});

export const listPurchaseOrdersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  supplierId: z.string().optional(),
  status: z.enum([PurchaseOrderStatus.PENDING, PurchaseOrderStatus.PARTIALLY_RECEIVED, PurchaseOrderStatus.RECEIVED, PurchaseOrderStatus.CANCELLED]).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.string().default('createdAt:desc'),
});

export const cancelPurchaseOrderSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 4 — ENTRADAS
// ═══════════════════════════════════════════════════════════════════════════

export const entryItemSchema = z.object({
  productId: z.string().optional(),
  skuInternal: z.string().optional(),
  barcodeExternal: z.string().optional(),
  nameCommercial: z.string().optional(),
  brandId: z.string().optional(),
  categoryId: z.string().optional(),
  partNumberOEM: z.string().optional(),
  quantity: z.number().int().positive(),
  unitCost: z.number().positive(),
  notes: z.string().max(500).optional(),
}).refine((d) => !!(d.productId || d.skuInternal || d.barcodeExternal || (d.nameCommercial && d.brandId && d.categoryId)), {
  message: 'Proporcionar identificador del producto o datos para crear uno nuevo'
});

export const registerEntrySchema = z.object({
  items: z.array(entryItemSchema).min(1),
  notes: z.string().max(1000).optional(),
});

export const listEntriesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().min(1).max(1000).default(20),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 5 — TESORERÍA
// ═══════════════════════════════════════════════════════════════════════════

export const openCashShiftSchema = z.object({
  initialBalance: decimalString,
  notes: z.string().max(500).optional(),
});

export const registerExpenseSchema = z.object({
  amount: decimalString,
  description: z.string().min(3).max(500),
  category: z.string().min(2).max(1000),
  paymentMethod: z.enum([PaymentMethod.CASH, PaymentMethod.CARD, PaymentMethod.TRANSFER]),
});

export const closeCashShiftSchema = z.object({
  physicalCount: decimalString,
  observations: z.string().max(1000).optional(),
});

export const dailySummaryQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  userId: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 6 — SEGURIDAD
// ═══════════════════════════════════════════════════════════════════════════

export const loginSchema = z.object({
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
});

export const registerSchema = z.object({
  name: z.string().min(2).max(150),
  email: z.string().email().toLowerCase().trim(),
  password: z.string().min(8),
  roleId: z.string().min(1),
});

export const changePasswordSchema = z.object({
  oldPassword: z.string().min(1),
  newPassword: z.string().min(8),
}).refine(data => data.oldPassword !== data.newPassword, {
  message: 'La nueva contraseña debe ser diferente',
  path: ['newPassword'],
});

export const auditLogsQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
  userId: z.string().optional(),
  entity: z.string().optional(),
  action: z.string().optional(),
  from: z.string().optional(),
  to: z.string().optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// MÓDULO 7 — REPORTES
// ═══════════════════════════════════════════════════════════════════════════

export const dateRangeQuerySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
});

export const exportTypeSchema = z.enum(['sales', 'inventory', 'products']);

export const companyConfigSchema = z.object({
  name: z.string().min(2).max(200).optional(),
  nit: z.string().min(5).max(30).optional(),
  address: z.string().min(5).max(300).optional(),
  phone: z.string().min(5).max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  footer: z.string().max(500).optional(),
});

// ═══════════════════════════════════════════════════════════════════════════
// TIPOS EXPORTADOS
// ═══════════════════════════════════════════════════════════════════════════

export type CreateBrandInput = z.infer<typeof createBrandSchema>;
export type UpdateBrandInput = z.infer<typeof updateBrandSchema>;
export type ListBrandsQuery = z.infer<typeof listBrandsQuerySchema>;
export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type ListCategoriesQuery = z.infer<typeof listCategoriesQuerySchema>;
export type CreateProductInput = z.infer<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
export type GetProductsQuery = z.infer<typeof getProductsQuerySchema>;
export type PatchStockInput = z.infer<typeof patchStockSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type SearchCustomersQuery = z.infer<typeof searchCustomersQuerySchema>;
export type CreateSaleInput = z.infer<typeof createSaleSchema>;
export type ListSalesQuery = z.infer<typeof listSalesQuerySchema>;
export type CancelSaleInput = z.infer<typeof cancelSaleSchema>;
export type CreateSupplierInput = z.infer<typeof createSupplierSchema>;
export type UpdateSupplierInput = z.infer<typeof updateSupplierSchema>;
export type ListSuppliersQuery = z.infer<typeof listSuppliersQuerySchema>;
export type CreatePurchaseOrderInput = z.infer<typeof createPurchaseOrderSchema>;
export type ReceivePurchaseOrderInput = z.infer<typeof receivePurchaseOrderSchema>;
export type ListPurchaseOrdersQuery = z.infer<typeof listPurchaseOrdersQuerySchema>;
export type CancelPurchaseOrderInput = z.infer<typeof cancelPurchaseOrderSchema>;
export type RegisterEntryInput = z.infer<typeof registerEntrySchema>;
export type ListEntriesQuery = z.infer<typeof listEntriesQuerySchema>;
export type OpenCashShiftInput = z.infer<typeof openCashShiftSchema>;
export type RegisterExpenseInput = z.infer<typeof registerExpenseSchema>;
export type CloseCashShiftInput = z.infer<typeof closeCashShiftSchema>;
export type DailySummaryQuery = z.infer<typeof dailySummaryQuerySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type AuditLogsQuery = z.infer<typeof auditLogsQuerySchema>;
export type DateRangeQuery = z.infer<typeof dateRangeQuerySchema>;
export type ExportType = z.infer<typeof exportTypeSchema>;
export type CompanyConfigInput = z.infer<typeof companyConfigSchema>;
