import { BaseDomainEvent } from '../../../src/core/domain/events/DomainEvent';
import { StockUpdatedEvent, StockLowEvent } from '../../../src/core/domain/events/InventoryEvents';
import { SaleCompletedEvent, SaleCancelledEvent } from '../../../src/core/domain/events/SaleEvents';

describe('Domain Events', () => {
  test('BaseDomainEvent debe generar UUID válido', () => {
    class TestEvent extends BaseDomainEvent {
      constructor(aggregateId: string) {
        super('test.event', aggregateId, {});
      }
    }
    
    const event = new TestEvent('test-123');
    expect(event.id).toBeDefined();
    expect(event.id.length).toBeGreaterThan(0);
    expect(event.occurredAt).toBeInstanceOf(Date);
  });

  test('StockUpdatedEvent debe tener estructura correcta', () => {
    const event = new StockUpdatedEvent('product-123', {
      previousStock: 10,
      newStock: 5,
      quantityChanged: -5,
      reason: 'venta'
    });
    
    expect(event.type).toBe('inventory.stock.updated');
    expect(event.aggregateId).toBe('product-123');
    expect(event.payload.previousStock).toBe(10);
    expect(event.payload.newStock).toBe(5);
  });

  test('StockLowEvent debe detectar stock bajo', () => {
    const event = new StockLowEvent('product-456', {
      sku: 'TEST-001',
      name: 'Producto Test',
      currentStock: 3,
      minStockLevel: 5
    });
    
    expect(event.type).toBe('inventory.stock.low');
    expect(event.payload.currentStock).toBeLessThan(event.payload.minStockLevel);
  });

  test('SaleCompletedEvent debe tener formato correcto', () => {
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
