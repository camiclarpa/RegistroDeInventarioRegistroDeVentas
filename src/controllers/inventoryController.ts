import { Request, Response } from 'express';
import * as inventoryService from '../services/inventoryService';
import {
  createBrandSchema, updateBrandSchema, listBrandsQuerySchema,
  createCategorySchema, updateCategorySchema, listCategoriesQuerySchema,
  createProductSchema, updateProductSchema, getProductsQuerySchema
} from '../utils/validators';
import { logger } from '../config/logger';

// Helper responses
const ok = (res: Response, data: any) => res.status(200).json({ success: true, data });
const fail = (res: Response, error: string, status = 400) => res.status(status).json({ success: false, error });
const handleError = (res: Response, err: any, context: string) => {
  logger.error(`[${context}]`, err);
  return res.status(500).json({ success: false, error: err.message || 'Error interno' });
};

// Helper para obtener ID de params (maneja string | string[])
const getId = (req: Request): string => {
  const id = req.params.id;
  if (Array.isArray(id)) return id[0];
  return id || '';
};

// ==================== MARCAS ====================
export async function createBrand(req: Request, res: Response) {
  try {
    const data = createBrandSchema.parse(req.body);
    const brand = await inventoryService.createBrand(data);
    return ok(res, brand);
  } catch (err) {
    return handleError(res, err, 'createBrand');
  }
}

export async function getBrands(req: Request, res: Response) {
  try {
    const query = listBrandsQuerySchema.parse(req.query);
    const result = await inventoryService.getBrands(query);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'getBrands');
  }
}

export async function getBrandById(req: Request, res: Response) {
  try {
    const id = getId(req);
    const brand = await inventoryService.getBrandById(id);
    if (!brand) return fail(res, 'Marca no encontrada', 404);
    return ok(res, brand);
  } catch (err) {
    return handleError(res, err, 'getBrandById');
  }
}

export async function updateBrand(req: Request, res: Response) {
  try {
    const id = getId(req);
    const data = updateBrandSchema.parse(req.body);
    const brand = await inventoryService.updateBrand(id, data);
    return ok(res, brand);
  } catch (err) {
    return handleError(res, err, 'updateBrand');
  }
}

export async function deleteBrand(req: Request, res: Response) {
  try {
    const id = getId(req);
    await inventoryService.deleteBrand(id);
    return ok(res, { deleted: true });
  } catch (err) {
    return handleError(res, err, 'deleteBrand');
  }
}

// ==================== CATEGORÍAS ====================
export async function createCategory(req: Request, res: Response) {
  try {
    const data = createCategorySchema.parse(req.body);
    const category = await inventoryService.createCategory(data);
    return ok(res, category);
  } catch (err) {
    return handleError(res, err, 'createCategory');
  }
}

export async function getCategories(req: Request, res: Response) {
  try {
    const query = listCategoriesQuerySchema.parse(req.query);
    const result = await inventoryService.getCategories(query);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'getCategories');
  }
}

export async function getCategoriesStats(req: Request, res: Response) {
  try {
    const stats = await inventoryService.getCategoriesStats();
    return ok(res, stats);
  } catch (err) {
    return handleError(res, err, 'getCategoriesStats');
  }
}

export async function getCategoryById(req: Request, res: Response) {
  try {
    const id = getId(req);
    const category = await inventoryService.getCategoryById(id);
    if (!category) return fail(res, 'Categoría no encontrada', 404);
    return ok(res, category);
  } catch (err) {
    return handleError(res, err, 'getCategoryById');
  }
}

export async function updateCategory(req: Request, res: Response) {
  try {
    const id = getId(req);
    const data = updateCategorySchema.parse(req.body);
    const category = await inventoryService.updateCategory(id, data);
    return ok(res, category);
  } catch (err) {
    return handleError(res, err, 'updateCategory');
  }
}

export async function deleteCategory(req: Request, res: Response) {
  try {
    const id = getId(req);
    await inventoryService.deleteCategory(id);
    return ok(res, { deleted: true });
  } catch (err) {
    return handleError(res, err, 'deleteCategory');
  }
}

// ==================== PRODUCTOS ====================
export async function createProduct(req: Request, res: Response) {
  try {
    const data = createProductSchema.parse(req.body);
    const product = await inventoryService.createProduct(data);
    return ok(res, product);
  } catch (err) {
    return handleError(res, err, 'createProduct');
  }
}

export async function getAllProducts(req: Request, res: Response) {
  try {
    const query = getProductsQuerySchema.parse({
      page: Number(req.query.page) || 1,
      limit: Number(req.query.limit) || 20,
      search: req.query.search as string,
      brandId: req.query.brandId as string,
      categoryId: req.query.categoryId as string,
      minStock: req.query.minStock === 'true',
      isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
      sortBy: (req.query.sortBy as string) || 'createdAt:desc',
    });
    const result = await inventoryService.getAllProducts(query);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'getAllProducts');
  }
}

export async function getProductById(req: Request, res: Response) {
  try {
    const id = getId(req);
    const product = await inventoryService.getProductById(id);
    if (!product) return fail(res, 'Producto no encontrado', 404);
    return ok(res, product);
  } catch (err) {
    return handleError(res, err, 'getProductById');
  }
}

export async function updateProduct(req: Request, res: Response) {
  try {
    const id = getId(req);
    const data = updateProductSchema.parse(req.body);
    const product = await inventoryService.updateProduct(id, data);
    return ok(res, product);
  } catch (err) {
    return handleError(res, err, 'updateProduct');
  }
}

export async function deleteProduct(req: Request, res: Response) {
  try {
    const id = getId(req);
    await inventoryService.deleteProduct(id);
    return ok(res, { deleted: true });
  } catch (err) {
    return handleError(res, err, 'deleteProduct');
  }
}

export async function adjustStock(req: Request, res: Response) {
  try {
    const id = getId(req);
    const { quantity, reason } = req.body;
    const userId = (req as any).user?.id || 'system';
    const result = await inventoryService.adjustStock(id, quantity, reason, userId);
    return ok(res, result);
  } catch (err) {
    return handleError(res, err, 'adjustStock');
  }
}

export async function getInventoryStats(req: Request, res: Response) {
  try {
    const stats = await inventoryService.getInventoryStats();
    return ok(res, stats);
  } catch (err) {
    return handleError(res, err, 'getInventoryStats');
  }
}

export async function exportProducts(req: Request, res: Response) {
  try {
    const products = await inventoryService.getAllProducts({ 
      page: 1, 
      limit: 10000,
      sortBy: 'createdAt:desc'
    });
    return ok(res, { data: products.data, total: products.total });
  } catch (err) {
    return handleError(res, err, 'exportProducts');
  }
}

export async function generateProductCode(req: Request, res: Response) {
  try {
    const categoryId = req.query.categoryId as string;
    if (!categoryId) return fail(res, 'categoryId requerido', 400);
    const code = await inventoryService.generateProductCode(categoryId);
    return ok(res, { code });
  } catch (err) {
    return handleError(res, err, 'generateProductCode');
  }
}
