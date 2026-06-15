import { BaseDomainEvent } from './DomainEvent';

export class SaleCreatedEvent extends BaseDomainEvent {
  constructor(
    saleId: string,
    payload: {
      saleNumber: string;
      customerId?: string;
      totalAmount: number;
      items: Array<{
        productId: string;
        productName: string;
        quantity: number;
        unitPrice: number;
        subtotal: number;
      }>;
      paymentMethod: string;
    }
  ) {
    super('sale.created', saleId, payload);
  }
}

export class SaleCompletedEvent extends BaseDomainEvent {
  constructor(
    saleId: string,
    payload: {
      saleNumber: string;
      customerId?: string;
      totalAmount: number;
      completedAt: Date;
    }
  ) {
    super('sale.completed', saleId, payload);
  }
}

export class SaleCancelledEvent extends BaseDomainEvent {
  constructor(
    saleId: string,
    payload: {
      saleNumber: string;
      reason?: string;
      cancelledAt: Date;
    }
  ) {
    super('sale.cancelled', saleId, payload);
  }
}
