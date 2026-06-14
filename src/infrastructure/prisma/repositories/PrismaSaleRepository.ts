import { PrismaClient } from '@prisma/client';
import { Sale } from '../../../core/domain/entities/Sale';
import { ISaleRepository } from '../../../core/domain/repositories/ISaleRepository';
import { Money } from '../../../core/domain/value-objects/Money';

export class PrismaSaleRepository implements ISaleRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(sale: Sale): Promise<void> {
    await this.prisma.sales.upsert({
      where: { id: sale.id },
      update: {
        saleNumber: sale.saleNumber,
        customerId: sale.customerId,
        userId: sale.userId,
        subtotal: sale.subtotal.getValue(),
        discountAmount: sale.discount.getValue(),
        taxAmount: sale.tax.getValue(),
        totalAmount: sale.total.getValue(),
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        notes: sale.notes,
        updatedAt: new Date()
      },
      create: {
        id: sale.id,
        saleNumber: sale.saleNumber,
        customerId: sale.customerId,
        userId: sale.userId,
        subtotal: sale.subtotal.getValue(),
        discountAmount: sale.discount.getValue(),
        taxAmount: sale.tax.getValue(),
        totalAmount: sale.total.getValue(),
        paymentMethod: sale.paymentMethod,
        status: sale.status,
        notes: sale.notes,
        createdAt: sale.createdAt,
        updatedAt: sale.updatedAt
      }
    });
  }

  async findById(id: string): Promise<Sale | null> {
    const record = await this.prisma.sales.findUnique({
      where: { id },
      include: { sale_items: true }
    });
    return record ? this.toDomain(record) : null;
  }

  async findByNumber(saleNumber: string): Promise<Sale | null> {
    const record = await this.prisma.sales.findUnique({
      where: { saleNumber }
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(page: number, limit: number, filters?: any): Promise<{ items: Sale[]; total: number }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.sales.findMany({
        where: filters,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.sales.count({ where: filters })
    ]);
    return { items: items.map(this.toDomain), total };
  }

  async updateStatus(id: string, status: string): Promise<void> {
    await this.prisma.sales.update({
      where: { id },
      data: { status, updatedAt: new Date() }
    });
  }

  async getSalesByCustomer(customerId: string): Promise<Sale[]> {
    const items = await this.prisma.sales.findMany({
      where: { customerId },
      orderBy: { createdAt: 'desc' }
    });
    return items.map(this.toDomain);
  }

  async getSalesByDateRange(startDate: Date, endDate: Date): Promise<Sale[]> {
    const items = await this.prisma.sales.findMany({
      where: {
        createdAt: {
          gte: startDate,
          lte: endDate
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return items.map(this.toDomain);
  }

  private toDomain(record: any): Sale {
    return new Sale(
      record.id,
      record.saleNumber,
      record.customerId,
      record.userId,
      record.sale_items?.map((item: any) => ({
        productId: item.productId,
        productName: item.productNameSnapshot,
        quantity: item.quantity,
        unitPrice: Number(item.unitPrice),
        subtotal: Number(item.lineTotal)
      })) || [],
      new Money(Number(record.subtotal), 'COP'),
      new Money(Number(record.discountAmount || 0), 'COP'),
      new Money(Number(record.taxAmount), 'COP'),
      new Money(Number(record.totalAmount), 'COP'),
      record.paymentMethod,
      record.status,
      record.notes,
      record.createdAt,
      record.updatedAt
    );
  }
}
