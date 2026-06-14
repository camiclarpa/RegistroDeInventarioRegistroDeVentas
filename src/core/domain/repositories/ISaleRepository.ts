import { Sale } from '../entities/Sale';

export interface ISaleRepository {
  save(sale: Sale): Promise<void>;
  findById(id: string): Promise<Sale | null>;
  findByNumber(saleNumber: string): Promise<Sale | null>;
  findAll(page: number, limit: number, filters?: any): Promise<{ items: Sale[]; total: number }>;
  updateStatus(id: string, status: string): Promise<void>;
  getSalesByCustomer(customerId: string): Promise<Sale[]>;
  getSalesByDateRange(startDate: Date, endDate: Date): Promise<Sale[]>;
}
