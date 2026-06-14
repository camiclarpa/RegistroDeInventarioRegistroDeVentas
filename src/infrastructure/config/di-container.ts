import 'reflect-metadata';
import { container, Lifecycle } from 'tsyringe';
import { PrismaClient } from '@prisma/client';

// Repositories
import { IConfigRepository } from '../../core/domain/repositories/IConfigRepository';
import { IProductRepository } from '../../core/domain/repositories/IProductRepository';
import { ISaleRepository } from '../../core/domain/repositories/ISaleRepository';
import { PrismaConfigRepository } from '../prisma/repositories/PrismaConfigRepository';
import { PrismaProductRepository } from '../prisma/repositories/PrismaProductRepository';
import { PrismaSaleRepository } from '../prisma/repositories/PrismaSaleRepository';

// Services
import { ConfigService } from '../../core/application/services/ConfigService';
import { ProductService } from '../../core/application/services/ProductService';
import { SaleService } from '../../core/application/services/SaleService';

// Prisma Client singleton
container.register<PrismaClient>(PrismaClient, {
  useClass: PrismaClient
}, { lifecycle: Lifecycle.Singleton });

// Config
container.register<IConfigRepository>('IConfigRepository', {
  useClass: PrismaConfigRepository
}, { lifecycle: Lifecycle.Singleton });
container.register(ConfigService, { useClass: ConfigService }, { lifecycle: Lifecycle.Singleton });

// Product
container.register<IProductRepository>('IProductRepository', {
  useClass: PrismaProductRepository
}, { lifecycle: Lifecycle.Singleton });
container.register(ProductService, { useClass: ProductService }, { lifecycle: Lifecycle.Singleton });

// Sale
container.register<ISaleRepository>('ISaleRepository', {
  useClass: PrismaSaleRepository
}, { lifecycle: Lifecycle.Singleton });
container.register(SaleService, { useClass: SaleService }, { lifecycle: Lifecycle.Singleton });

export { container };
