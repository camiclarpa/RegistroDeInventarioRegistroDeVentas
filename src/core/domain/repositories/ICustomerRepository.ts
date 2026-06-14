import { Customer } from '../entities/Customer';

export interface ICustomerRepository {
  save(customer: Customer): Promise<void>;
  findById(id: string): Promise<Customer | null>;
  findByEmail(email: string): Promise<Customer | null>;
  findByPhone(phone: string): Promise<Customer | null>;
  findByIdentification(identification: string): Promise<Customer | null>;
  findAll(page: number, limit: number, search?: string): Promise<{ items: Customer[]; total: number }>;
  updateLoyaltyPoints(id: string, points: number): Promise<void>;
  updateTotalSpent(id: string, amount: number): Promise<void>;
}
