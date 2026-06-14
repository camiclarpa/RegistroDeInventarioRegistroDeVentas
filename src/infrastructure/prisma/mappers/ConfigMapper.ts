import { Config } from '../../../core/domain/entities/Config';
import { business_config as PrismaConfig } from '@prisma/client';

export class ConfigMapper {
  static toDomain(prismaConfig: PrismaConfig): Config {
    return new Config(
      prismaConfig.id,
      prismaConfig.businessName ?? '',
      prismaConfig.nit ?? '',
      prismaConfig.address ?? '',
      prismaConfig.phone ?? '',
      prismaConfig.email ?? '',
      Number(prismaConfig.taxRate ?? 19),
      prismaConfig.footer ?? '',
      prismaConfig.createdAt ?? new Date(),
      prismaConfig.updatedAt ?? new Date()
    );
  }

  static toPersistence(config: Config): any {
    return {
      id: config.id,
      businessName: config.businessName,
      nit: config.nit,
      address: config.address,
      phone: config.phone,
      email: config.email,
      taxRate: config.taxRate,
      footer: config.footer,
      updatedAt: config.updatedAt
    };
  }
}
