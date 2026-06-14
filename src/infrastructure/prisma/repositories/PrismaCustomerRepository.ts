import { PrismaClient } from '@prisma/client';
import { Customer } from '../../../core/domain/entities/Customer';
import { ICustomerRepository } from '../../../core/domain/repositories/ICustomerRepository';
import { Email } from '../../../core/domain/value-objects/Email';
import { PhoneNumber } from '../../../core/domain/value-objects/PhoneNumber';

export class PrismaCustomerRepository implements ICustomerRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(customer: Customer): Promise<void> {
    await this.prisma.customers.upsert({
      where: { id: customer.id },
      update: {
        name: customer.name,
        phone: customer.phone?.getValue() || null,
        email: customer.email?.getValue() || null,
        identificationNumber: customer.identificationNumber,
        address: customer.address,
        isActive: customer.isActive,
        loyaltyPoints: customer.loyaltyPoints,
        totalSpent: customer.totalSpent,
        updatedAt: new Date()
      },
      create: {
        id: customer.id,
        name: customer.name,
        phone: customer.phone?.getValue() || null,
        email: customer.email?.getValue() || null,
        identificationNumber: customer.identificationNumber,
        address: customer.address,
        isActive: customer.isActive,
        loyaltyPoints: customer.loyaltyPoints,
        totalSpent: customer.totalSpent,
        createdAt: customer.createdAt,
        updatedAt: customer.updatedAt
      }
    });
  }

  async findById(id: string): Promise<Customer | null> {
    const record = await this.prisma.customers.findUnique({
      where: { id }
    });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<Customer | null> {
    const record = await this.prisma.customers.findFirst({
      where: { email }
    });
    return record ? this.toDomain(record) : null;
  }

  async findByPhone(phone: string): Promise<Customer | null> {
    const record = await this.prisma.customers.findUnique({
      where: { phone }
    });
    return record ? this.toDomain(record) : null;
  }

  async findByIdentification(identification: string): Promise<Customer | null> {
    const record = await this.prisma.customers.findUnique({
      where: { identificationNumber: identification }
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(page: number, limit: number, search?: string): Promise<{ items: Customer[]; total: number }> {
    const skip = (page - 1) * limit;
    let where: any = {};
    
    if (search) {
      where = {
        OR: [
          { name: { contains: search, mode: 'insensitive' as const } },
          { email: { contains: search, mode: 'insensitive' as const } },
          { phone: { contains: search, mode: 'insensitive' as const } }
        ]
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.customers.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.customers.count({ where })
    ]);
    
    return { items: items.map(this.toDomain), total };
  }

  async updateLoyaltyPoints(id: string, points: number): Promise<void> {
    await this.prisma.customers.update({
      where: { id },
      data: { loyaltyPoints: points, updatedAt: new Date() }
    });
  }

  async updateTotalSpent(id: string, amount: number): Promise<void> {
    await this.prisma.customers.update({
      where: { id },
      data: { totalSpent: amount, updatedAt: new Date() }
    });
  }

  private toDomain(record: any): Customer {
    return new Customer(
      record.id,
      record.name,
      record.phone ? PhoneNumber.create(record.phone) : null,
      record.email ? Email.create(record.email) : null,
      record.identificationNumber,
      record.address,
      record.isActive,
      record.loyaltyPoints,
      Number(record.totalSpent),
      record.createdAt,
      record.updatedAt
    );
  }
}
