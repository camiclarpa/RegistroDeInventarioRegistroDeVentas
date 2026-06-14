import { PrismaClient } from '@prisma/client';
import { Config } from '../../../core/domain/entities/Config';
import { IConfigRepository } from '../../../core/domain/repositories/IConfigRepository';

export class PrismaConfigRepository implements IConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Config | null> {
    const record = await this.prisma.business_config.findUnique({
      where: { id }
    });
    return record ? Config.fromPrisma(record) : null;
  }

  async update(config: Config): Promise<Config> {
    const record = await this.prisma.business_config.update({
      where: { id: config.id },
      data: {
        businessName: config.businessName,
        nit: config.nit,
        address: config.address,
        phone: config.phone,
        email: config.email,
        taxRate: config.taxRate,
        footer: config.footer,
        updatedAt: config.updatedAt
      }
    });
    return Config.fromPrisma(record);
  }
}
