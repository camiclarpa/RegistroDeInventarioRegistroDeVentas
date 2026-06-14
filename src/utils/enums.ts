export const MovementType = {
  ENTRY: 'ENTRY',
  EXIT: 'EXIT',
  ADJUSTMENT_POS: 'ADJUSTMENT_POS',
  ADJUSTMENT_NEG: 'ADJUSTMENT_NEG',
  MERMA: 'MERMA',
  RETURN: 'RETURN'
} as const;

export type MovementType = typeof MovementType[keyof typeof MovementType];

export const PaymentMethod = {
  CASH: 'CASH',
  CARD: 'CARD',
  TRANSFER: 'TRANSFER',
  MIXED: 'MIXED',
  CREDIT: 'CREDIT',
  NEQUI: 'NEQUI',
  DAVIPLATA: 'DAVIPLATA'
} as const;

export type PaymentMethod = typeof PaymentMethod[keyof typeof PaymentMethod];

export const SaleStatus = {
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
  REFUNDED: 'REFUNDED'
} as const;

export type SaleStatus = typeof SaleStatus[keyof typeof SaleStatus];

export const PurchaseOrderStatus = {
  PENDING: 'PENDING',
  PARTIALLY_RECEIVED: 'PARTIALLY_RECEIVED',
  RECEIVED: 'RECEIVED',
  CANCELLED: 'CANCELLED'
} as const;

export type PurchaseOrderStatus = typeof PurchaseOrderStatus[keyof typeof PurchaseOrderStatus];

export const AccountStatus = {
  PENDING: 'PENDING',
  PARTIALLY_PAID: 'PARTIALLY_PAID',
  PAID: 'PAID',
  OVERDUE: 'OVERDUE'
} as const;

export type AccountStatus = typeof AccountStatus[keyof typeof AccountStatus];
