import { Money } from '../value-objects/Money';

export interface SaleItem {
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  subtotal: number;
}

export interface CreateSaleParams {
  id?: string;
  saleNumber: string;
  customerId?: string;
  userId: string;
  items: SaleItem[];
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT';
  notes?: string;
}

export class Sale {
  constructor(
    public readonly id: string,
    public readonly saleNumber: string,
    public readonly customerId: string | null,
    public readonly userId: string,
    public readonly items: SaleItem[],
    public readonly subtotal: Money,
    public readonly discount: Money,
    public readonly tax: Money,
    public readonly total: Money,
    public readonly paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | 'MIXED' | 'CREDIT',
    public readonly status: 'COMPLETED' | 'CANCELLED' | 'REFUNDED',
    public readonly notes: string | null,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(params: CreateSaleParams): Sale {
    const subtotalAmount = params.items.reduce((sum, item) => sum + item.subtotal, 0);
    const discountAmount = 0;
    const taxAmount = subtotalAmount * 0.19;
    const totalAmount = subtotalAmount - discountAmount + taxAmount;

    return new Sale(
      params.id || crypto.randomUUID(),
      params.saleNumber,
      params.customerId || null,
      params.userId,
      params.items,
      Money.create(subtotalAmount, 'COP'),
      Money.create(discountAmount, 'COP'),
      Money.create(taxAmount, 'COP'),
      Money.create(totalAmount, 'COP'),
      params.paymentMethod,
      'COMPLETED',
      params.notes || null,
      new Date(),
      new Date()
    );
  }

  cancel(): Sale {
    if (this.status === 'CANCELLED') {
      throw new Error('Sale already cancelled');
    }
    return new Sale(
      this.id,
      this.saleNumber,
      this.customerId,
      this.userId,
      this.items,
      this.subtotal,
      this.discount,
      this.tax,
      this.total,
      this.paymentMethod,
      'CANCELLED',
      this.notes,
      this.createdAt,
      new Date()
    );
  }

  refund(): Sale {
    if (this.status !== 'COMPLETED') {
      throw new Error('Only completed sales can be refunded');
    }
    return new Sale(
      this.id,
      this.saleNumber,
      this.customerId,
      this.userId,
      this.items,
      this.subtotal,
      this.discount,
      this.tax,
      this.total,
      this.paymentMethod,
      'REFUNDED',
      this.notes,
      this.createdAt,
      new Date()
    );
  }

  getTotal(): number {
    return this.total.getValue();
  }
}
