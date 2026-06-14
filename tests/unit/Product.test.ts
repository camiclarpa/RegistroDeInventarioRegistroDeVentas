import { Product, SKU, Money } from '../../src/core';

describe('Product Entity', () => {
  it('should create a valid product', () => {
    const product = Product.create({
      skuInternal: 'TEST001',
      nameCommercial: 'Test Product',
      brandId: 'brand_001',
      categoryId: 'cat_001',
      costPriceAvg: 100,
      salePriceBase: 150,
      stockQuantity: 10,
      minStockLevel: 5
    });

    expect(product).toBeDefined();
    expect(product.sku.getValue()).toBe('TEST001');
    expect(product.isLowStock()).toBe(false);
  });

  it('should detect low stock', () => {
    const product = Product.create({
      skuInternal: 'TEST002',
      nameCommercial: 'Low Stock Product',
      brandId: 'brand_001',
      categoryId: 'cat_001',
      costPriceAvg: 100,
      salePriceBase: 150,
      stockQuantity: 3,
      minStockLevel: 5
    });

    expect(product.isLowStock()).toBe(true);
  });
});
