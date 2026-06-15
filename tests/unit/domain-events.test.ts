import { ProductCreatedEvent } from '../../src/core/domain/events/InventoryEvents';

describe('Domain Events', () => {
    test('ProductCreatedEvent debe crearse', () => {
        const event = new ProductCreatedEvent('prod-123', {
            sku: 'TEST-001',
            name: 'Producto Test',
            price: 100,
            stock: 50
        });
        expect(event.type).toBe('inventory.product.created');
        expect(event.aggregateId).toBe('prod-123');
    });
});
