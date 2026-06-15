import { StockUpdatedEvent } from '../../src/core/domain/events/InventoryEvents';
import { SaleCompletedEvent } from '../../src/core/domain/events/SaleEvents';

describe('Domain Events Básicos', () => {
  test('StockUpdatedEvent debe crearse', () => {
    const event = new StockUpdatedEvent('prod-123', {
      previousStock: 10,
      newStock: 5,
      quantityChanged: -5,
      reason: 'test'
    });
    expect(event).toBeDefined();
    expect(event.type).toBe('inventory.stock.updated');
    expect(event.aggregateId).toBe('prod-123');
  });

  test('SaleCompletedEvent debe crearse', () => {
    const event = new SaleCompletedEvent('sale-789', {
      saleNumber: 'FAC-001',
      customerId: 'cust-001',
      totalAmount: 150000,
      completedAt: new Date()
    });
    expect(event).toBeDefined();
    expect(event.type).toBe('sale.completed');
    expect(event.payload.totalAmount).toBe(150000);
  });
});
