import { Customer, CreateCustomerParams } from '../../domain/entities/Customer';
import { ICustomerRepository } from '../../domain/repositories/ICustomerRepository';

export class CustomerService {
  constructor(private readonly customerRepo: ICustomerRepository) {}

  async createCustomer(params: CreateCustomerParams): Promise<Customer> {
    // Verificar si ya existe por email o teléfono
    if (params.email) {
      const existing = await this.customerRepo.findByEmail(params.email);
      if (existing) {
        throw new Error(`Customer with email ${params.email} already exists`);
      }
    }
    if (params.phone) {
      const existing = await this.customerRepo.findByPhone(params.phone);
      if (existing) {
        throw new Error(`Customer with phone ${params.phone} already exists`);
      }
    }

    const customer = Customer.create(params);
    await this.customerRepo.save(customer);
    return customer;
  }

  async getCustomerById(id: string): Promise<Customer | null> {
    return this.customerRepo.findById(id);
  }

  async getCustomerByEmail(email: string): Promise<Customer | null> {
    return this.customerRepo.findByEmail(email);
  }

  async listCustomers(page: number = 1, limit: number = 20, search?: string): Promise<{
    items: Customer[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { items, total } = await this.customerRepo.findAll(page, limit, search);
    return { items, total, page, limit };
  }

  async addLoyaltyPoints(customerId: string, points: number): Promise<Customer> {
    const customer = await this.customerRepo.findById(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }
    const updated = customer.addLoyaltyPoints(points);
    await this.customerRepo.updateLoyaltyPoints(customerId, updated.loyaltyPoints);
    return updated;
  }

  async updateCustomerSpent(customerId: string, amount: number): Promise<Customer> {
    const customer = await this.customerRepo.findById(customerId);
    if (!customer) {
      throw new Error(`Customer ${customerId} not found`);
    }
    const updated = customer.updateTotalSpent(amount);
    await this.customerRepo.updateTotalSpent(customerId, updated.totalSpent);
    return updated;
  }

  async deactivateCustomer(id: string): Promise<Customer> {
    const customer = await this.customerRepo.findById(id);
    if (!customer) {
      throw new Error(`Customer ${id} not found`);
    }
    const deactivated = customer.deactivate();
    await this.customerRepo.save(deactivated);
    return deactivated;
  }
}
