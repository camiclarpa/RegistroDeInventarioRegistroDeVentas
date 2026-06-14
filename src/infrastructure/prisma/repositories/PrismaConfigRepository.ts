import { PrismaClient } from '@prisma/client';
import { Config } from '../../../core/domain/entities/Config';
import { IConfigRepository } from '../../../core/domain/repositories/IConfigRepository';
import { ConfigMapper } from '../mappers/ConfigMapper';

export class PrismaConfigRepository implements IConfigRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async findById(id: string): Promise<Config | null> {
    const record = await this.prisma.business_config.findUnique({
      where: { id }
    });
    return record ? ConfigMapper.toDomain(record) : null;
  }

  async update(config: Config): Promise<Config> {
    const record = await this.prisma.business_config.update({
      where: { id: config.id },
      data: ConfigMapper.toPersistence(config)
    });
    return ConfigMapper.toDomain(record);
  }
}
