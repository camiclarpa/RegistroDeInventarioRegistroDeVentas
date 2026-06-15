import { BaseDomainEvent } from './DomainEvent';

export class ProductCreatedEvent extends BaseDomainEvent {
  constructor(
    productId: string,
    payload: {
      sku: string;
      name: string;
      price: number;
      stock: number;
    }
  ) {
    super('inventory.product.created', productId, payload);
  }
}

export class StockUpdatedEvent extends BaseDomainEvent {
  constructor(
    productId: string,
    payload: {
      previousStock: number;
      newStock: number;
      quantityChanged: number;
      reason: string;
    }
  ) {
    super('inventory.stock.updated', productId, payload);
  }
}

export class StockLowEvent extends BaseDomainEvent {
  constructor(
    productId: string,
    payload: {
      sku: string;
      name: string;
      currentStock: number;
      minStockLevel: number;
    }
  ) {
    super('inventory.stock.low', productId, payload);
  }
}
