import { StockUpdatedEvent, StockLowEvent } from '../../src/core/domain/events/InventoryEvents';
import { SaleCompletedEvent } from '../../src/core/domain/events/SaleEvents';

describe('Domain Events', () => {
    test('StockUpdatedEvent debe crearse correctamente', () => {
        const event = new StockUpdatedEvent('prod-123', {
            previousStock: 10,
            newStock: 5,
            quantityChanged: -5,
            reason: 'sale'
        });
        expect(event.type).toBe('inventory.stock.updated');
        expect(event.aggregateId).toBe('prod-123');
        expect(event.payload.newStock).toBe(5);
    });

    test('StockLowEvent debe crearse correctamente', () => {
        const event = new StockLowEvent('prod-456', {
            sku: 'TEST-001',
            name: 'Producto Test',
            currentStock: 3,
            minStockLevel: 5
        });
        expect(event.type).toBe('inventory.stock.low');
        expect(event.payload.currentStock).toBeLessThan(event.payload.minStockLevel);
    });

    test('SaleCompletedEvent debe crearse correctamente', () => {
        const event = new SaleCompletedEvent('sale-789', {
            saleNumber: 'FAC-001',
            customerId: 'cust-001',
            totalAmount: 150000,
            completedAt: new Date()
        });
        expect(event.type).toBe('sale.completed');
        expect(event.payload.totalAmount).toBe(150000);
    });
});
