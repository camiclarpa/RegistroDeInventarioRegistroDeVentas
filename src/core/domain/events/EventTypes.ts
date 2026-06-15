export interface BaseEventPayload {
    id?: string;
    timestamp?: Date;
}

export interface ProductCreatedPayload extends BaseEventPayload {
    sku: string;
    name: string;
    price: number;
    stock: number;
}

export interface StockUpdatedPayload extends BaseEventPayload {
    previousStock: number;
    newStock: number;
    quantityChanged: number;
    reason: string;
}

export interface StockLowPayload extends BaseEventPayload {
    sku: string;
    name: string;
    currentStock: number;
    minStockLevel: number;
}

export interface SaleCompletedPayload extends BaseEventPayload {
    saleNumber: string;
    customerId?: string;
    totalAmount: number;
    completedAt: Date;
}
