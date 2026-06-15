import { Product } from '../../../src/core/domain/entities/Product';
import { SKU } from '../../../src/core/domain/value-objects/SKU';
import { Money } from '../../../src/core/domain/value-objects/Money';

describe('Product Entity', () => {
    test('debe crear un producto válido', () => {
        const product = Product.create({
            skuInternal: 'TEST-001',
            nameCommercial: 'Producto Test',
            brandId: 'brand_001',
            categoryId: 'cat_001',
            costPriceAvg: 100,
            salePriceBase: 150,
            stockQuantity: 10,
            minStockLevel: 5
        });
        
        expect(product).toBeDefined();
        expect(product.sku.getValue()).toBe('TEST-001');
        expect(product.name).toBe('Producto Test');
        expect(product.stockQuantity).toBe(10);
    });
    
    test('debe detectar stock bajo', () => {
        const product = Product.create({
            skuInternal: 'TEST-002',
            nameCommercial: 'Producto Low Stock',
            brandId: 'brand_001',
            categoryId: 'cat_001',
            costPriceAvg: 100,
            salePriceBase: 150,
            stockQuantity: 3,
            minStockLevel: 5
        });
        
        expect(product.isLowStock()).toBe(true);
    });
    
    test('debe actualizar stock correctamente', () => {
        const product = Product.create({
            skuInternal: 'TEST-003',
            nameCommercial: 'Producto Stock',
            brandId: 'brand_001',
            categoryId: 'cat_001',
            costPriceAvg: 100,
            salePriceBase: 150,
            stockQuantity: 10,
            minStockLevel: 5
        });
        
        const updated = product.updateStock(-3);
        expect(updated.stockQuantity).toBe(7);
    });
});
