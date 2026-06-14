import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { MovementType } from '../utils/enums';
import type {
  CreateBrandInput,
  UpdateBrandInput,
  ListBrandsQuery,
  CreateCategoryInput,
  UpdateCategoryInput,
  ListCategoriesQuery,
  CreateProductInput,
  UpdateProductInput,
  GetProductsQuery,
} from '../utils/validators';

// ==================== MARCAS ====================
export async function createBrand(data: CreateBrandInput) {
  logger.info('[inventoryService] createBrand', { name: data.name });
  return prisma.brands.create({
    data: {
      id: crypto.randomUUID(),
      name: data.name,
      logoUrl: data.logoUrl,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function getBrands(query: ListBrandsQuery) {
  const { page = 1, limit = 20, query: search, isActive } = query;
  const skip = (page - 1) * limit;
  
  const where: any = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (isActive !== undefined) where.isActive = isActive;
  
  const [data, total] = await Promise.all([
    prisma.brands.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.brands.count({ where }),
  ]);
  
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getBrandById(id: string) {
  return prisma.brands.findUnique({ where: { id } });
}

export async function updateBrand(id: string, data: UpdateBrandInput) {
  return prisma.brands.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
}

export async function deleteBrand(id: string) {
  return prisma.brands.delete({ where: { id } });
}

export async function getOrCreateGenericBrand(): Promise<string> {
  const generic = await prisma.brands.findFirst({ where: { name: 'Genérico' } });
  if (generic) return generic.id;
  
  const newBrand = await prisma.brands.create({
    data: {
      id: crypto.randomUUID(),
      name: 'Genérico',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
  return newBrand.id;
}

// ==================== CATEGORÍAS ====================
export async function createCategory(data: CreateCategoryInput) {
  logger.info('[inventoryService] createCategory', { name: data.name });
  return prisma.categories.create({
    data: {
      id: crypto.randomUUID(),
      name: data.name,
      slug: data.slug || data.name.toLowerCase().replace(/\s+/g, '-'),
      codePrefix: data.codePrefix,
      marginPercentage: Number(data.marginPercentage),
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

export async function getCategories(query: ListCategoriesQuery) {
  const { page = 1, limit = 20, query: search, isActive } = query;
  const skip = (page - 1) * limit;
  
  const where: any = {};
  if (search) where.name = { contains: search, mode: 'insensitive' };
  if (isActive !== undefined) where.isActive = isActive;
  
  const [data, total] = await Promise.all([
    prisma.categories.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.categories.count({ where }),
  ]);
  
  return { data, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getCategoryById(id: string) {
  return prisma.categories.findUnique({ where: { id } });
}

export async function updateCategory(id: string, data: UpdateCategoryInput) {
  return prisma.categories.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
  });
}

export async function deleteCategory(id: string) {
  return prisma.categories.delete({ where: { id } });
}

// ==================== PRODUCTOS ====================
export async function createProduct(data: CreateProductInput) {
  logger.info('[inventoryService] createProduct', { name: data.nameCommercial });
  
  const skuInternal = data.skuInternal || `SKU_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`;
  
  return prisma.products.create({
    data: {
      id: crypto.randomUUID(),
      skuInternal,
      barcodeExternal: data.barcodeExternal,
      partNumberOEM: data.partNumberOEM,
      brandId: data.brandId,
      categoryId: data.categoryId,
      nameCommercial: data.nameCommercial,
      descriptionTech: data.descriptionTech,
      compatibleModels: data.compatibleModels || [],
      locationBin: data.locationBin || 'SIN-UBICACION',
      costPriceAvg: data.costPriceAvg,
      salePriceBase: data.salePriceBase || data.costPriceAvg * 1.3,
      taxRate: data.taxRate || 19,
      stockQuantity: data.stockQuantity || 0,
      minStockLevel: data.minStockLevel || 5,
      maxStockLevel: data.maxStockLevel,
      warrantyDays: 0,
      isActive: data.isActive ?? true,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    include: { brands: true, categories: true },
  });
}

export async function getAllProducts(query: GetProductsQuery) {
  const { page = 1, limit = 20, search, brandId, categoryId, isActive } = query;
  const skip = (page - 1) * limit;
  
  const where: any = {};
  if (search) {
    where.OR = [
      { nameCommercial: { contains: search, mode: 'insensitive' } },
      { skuInternal: { contains: search, mode: 'insensitive' } },
      { partNumberOEM: { contains: search, mode: 'insensitive' } },
    ];
  }
  if (brandId) where.brandId = brandId;
  if (categoryId) where.categoryId = categoryId;
  if (isActive !== undefined) where.isActive = isActive;
  
  const [data, total] = await Promise.all([
    prisma.products.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { brands: true, categories: true },
    }),
    prisma.products.count({ where }),
  ]);
  
  return { data, total };
}

export async function getProductById(id: string) {
  return prisma.products.findUnique({
    where: { id },
    include: { brands: true, categories: true },
  });
}

export async function updateProduct(id: string, data: UpdateProductInput) {
  return prisma.products.update({
    where: { id },
    data: { ...data, updatedAt: new Date() },
    include: { brands: true, categories: true },
  });
}

export async function deleteProduct(id: string) {
  return prisma.products.delete({ where: { id } });
}

// ==================== MOVIMIENTOS DE INVENTARIO ====================
export async function createInventoryMovement(data: {
  productId: string;
  type: MovementType;
  quantity: number;
  unitCostAtMoment?: number;
  reason: string;
  referenceDoc?: string;
  performedByUserId: string;
}) {
  return prisma.inventory_movements.create({
    data: {
      id: crypto.randomUUID(),
      productId: data.productId,
      type: data.type,
      quantity: data.quantity,
      unitCostAtMoment: data.unitCostAtMoment,
      reason: data.reason,
      referenceDoc: data.referenceDoc,
      performedByUserId: data.performedByUserId,
      timestamp: new Date(),
    },
  });
}

export async function adjustStock(
  productId: string,
  quantity: number,
  reason: string,
  performedByUserId: string,
  unitCost?: number
) {
  const product = await prisma.products.findUnique({ where: { id: productId } });
  if (!product) throw new Error('Producto no encontrado');
  
  const newStock = product.stockQuantity + quantity;
  if (newStock < 0) throw new Error('Stock insuficiente');
  
  const type = quantity > 0 ? MovementType.ENTRY : MovementType.EXIT;
  
  await Promise.all([
    prisma.products.update({
      where: { id: productId },
      data: { stockQuantity: newStock, updatedAt: new Date() },
    }),
    createInventoryMovement({
      productId,
      type,
      quantity: Math.abs(quantity),
      unitCostAtMoment: Number(unitCost || product.costPriceAvg),
      reason,
      performedByUserId,
    }),
  ]);
  
  return { success: true, newStock };
}

// ==================== ESTADÍSTICAS ====================
export async function getCategoriesStats() {
  const [total, active] = await Promise.all([
    prisma.categories.count(),
    prisma.categories.count({ where: { isActive: true } }),
  ]);
  return { total, active, inactive: total - active };
}

export async function getInventoryStats() {
  const [totalProducts, lowStock, totalValue] = await Promise.all([
    prisma.products.count(),
    prisma.products.count({ where: { stockQuantity: { lt: prisma.products.fields.minStockLevel } } }),
    prisma.products.aggregate({
      _sum: { stockQuantity: true },
    }),
  ]);
  
  return {
    totalProducts,
    lowStock,
    totalInventoryValue: (totalProducts * 10000) || 0, // Placeholder
  };
}

export async function generateProductCode(categoryId: string): Promise<string> {
  const category = await prisma.categories.findUnique({ where: { id: categoryId } });
  const prefix = category?.codePrefix || 'PRD';
  const count = await prisma.products.count();
  return `${prefix}-${String(count + 1).padStart(5, '0')}`;
}
