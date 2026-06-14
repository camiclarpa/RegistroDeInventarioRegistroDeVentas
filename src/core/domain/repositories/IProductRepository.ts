import { Product } from '../entities/Product';

export interface ProductFilters {
  brandId?: string;
  categoryId?: string;
  isActive?: boolean;
  minStock?: number;
  search?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface IProductRepository {
  save(product: Product): Promise<void>;
  findById(id: string): Promise<Product | null>;
  findBySKU(sku: string): Promise<Product | null>;
  findAll(filters: ProductFilters, page: number, limit: number): Promise<PaginatedResult<Product>>;
  updateStock(id: string, quantity: number): Promise<void>;
  findLowStock(threshold: number): Promise<Product[]>;
  delete(id: string): Promise<void>;
  exists(sku: string): Promise<boolean>;
}
