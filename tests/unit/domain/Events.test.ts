import { ProductCreatedEvent, StockUpdatedEvent, StockLowEvent } from '../../../src/core/domain/events/InventoryEvents';
import { SaleCompletedEvent } from '../../../src/core/domain/events/SaleEvents';

describe('Domain Events', () => {
    test('ProductCreatedEvent debe crearse correctamente', () => {
        const event = new ProductCreatedEvent('prod-123', {
            sku: 'TEST-001',
            name: 'Producto Test',
            price: 100,
            stock: 50
        });
        expect(event.type).toBe('inventory.product.created');
        expect(event.aggregateId).toBe('prod-123');
        expect(event.payload.sku).toBe('TEST-001');
    });
    
    test('SaleCompletedEvent debe crearse correctamente', () => {
        const event = new SaleCompletedEvent('sale-456', {
            saleNumber: 'FAC-001',
            totalAmount: 150000,
            completedAt: new Date()
        });
        expect(event.type).toBe('sale.completed');
        expect(event.payload.saleNumber).toBe('FAC-001');
    });
});
