import { Prisma } from '@prisma/client';
import { Product } from '../../../core/domain/entities/Product';
import { Money } from '../../../core/domain/value-objects/Money';
import { SKU } from '../../../core/domain/value-objects/SKU';

type PrismaProduct = Prisma.productsGetPayload<object>;

export class ProductMapper {
  static toDomain(prismaProduct: PrismaProduct): Product {
    return new Product(
      prismaProduct.id,
      SKU.create(prismaProduct.skuInternal),
      prismaProduct.nameCommercial,
      prismaProduct.brandId,
      prismaProduct.categoryId,
      Money.create(Number(prismaProduct.costPriceAvg), 'COP'),
      Money.create(Number(prismaProduct.salePriceBase), 'COP'),
      prismaProduct.stockQuantity,
      prismaProduct.minStockLevel,
      prismaProduct.isActive,
      prismaProduct.createdAt,
      prismaProduct.updatedAt
    );
  }

  static toPersistence(product: Product): any {
    return {
      id: product.id,
      skuInternal: product.sku.getValue(),
      nameCommercial: product.name,
      brandId: product.brandId,
      categoryId: product.categoryId,
      costPriceAvg: product.costPrice.getValue(),
      salePriceBase: product.salePrice.getValue(),
      stockQuantity: product.stockQuantity,
      minStockLevel: product.minStockLevel,
      isActive: product.isActive,
      updatedAt: new Date()
    };
  }
}
