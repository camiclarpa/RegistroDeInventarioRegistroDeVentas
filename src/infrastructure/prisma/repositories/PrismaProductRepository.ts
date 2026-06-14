import { PrismaClient } from '@prisma/client';
import { Product } from '../../../core/domain/entities/Product';
import { IProductRepository, ProductFilters, PaginatedResult } from '../../../core/domain/repositories/IProductRepository';
import { ProductMapper } from '../mappers/ProductMapper';

export class PrismaProductRepository implements IProductRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(product: Product): Promise<void> {
    const data = ProductMapper.toPersistence(product);
    await this.prisma.products.upsert({
      where: { id: product.id },
      update: data,
      create: data
    });
  }

  async findById(id: string): Promise<Product | null> {
    const record = await this.prisma.products.findUnique({
      where: { id }
    });
    return record ? ProductMapper.toDomain(record) : null;
  }

  async findBySKU(sku: string): Promise<Product | null> {
    const record = await this.prisma.products.findUnique({
      where: { skuInternal: sku }
    });
    return record ? ProductMapper.toDomain(record) : null;
  }

  async findAll(filters: ProductFilters, page: number, limit: number): Promise<PaginatedResult<Product>> {
    const where: any = {};

    if (filters.brandId) where.brandId = filters.brandId;
    if (filters.categoryId) where.categoryId = filters.categoryId;
    if (filters.isActive !== undefined) where.isActive = filters.isActive;
    if (filters.minStock) where.stockQuantity = { lte: filters.minStock };
    if (filters.search) {
      where.OR = [
        { nameCommercial: { contains: filters.search, mode: 'insensitive' } },
        { skuInternal: { contains: filters.search, mode: 'insensitive' } }
      ];
    }

    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.products.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.products.count({ where })
    ]);

    return {
      items: items.map(ProductMapper.toDomain),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  async updateStock(id: string, quantity: number): Promise<void> {
    await this.prisma.products.update({
      where: { id },
      data: { stockQuantity: quantity, updatedAt: new Date() }
    });
  }

  async findLowStock(threshold: number): Promise<Product[]> {
    const records = await this.prisma.products.findMany({
      where: {
        isActive: true,
        stockQuantity: { lte: threshold }
      },
      orderBy: { stockQuantity: 'asc' }
    });
    return records.map(ProductMapper.toDomain);
  }

  async delete(id: string): Promise<void> {
    await this.prisma.products.update({
      where: { id },
      data: { isActive: false, updatedAt: new Date() }
    });
  }

  async exists(sku: string): Promise<boolean> {
    const count = await this.prisma.products.count({
      where: { skuInternal: sku }
    });
    return count > 0;
  }
}
