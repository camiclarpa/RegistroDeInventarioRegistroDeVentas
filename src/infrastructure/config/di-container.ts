import 'reflect-metadata';
import { container, Lifecycle } from 'tsyringe';
import { PrismaClient } from '@prisma/client';

// Repositories
import { IProductRepository } from '../../core/domain/repositories/IProductRepository';
import { IConfigRepository } from '../../core/domain/repositories/IConfigRepository';
import { PrismaProductRepository } from '../prisma/repositories/PrismaProductRepository';
import { PrismaConfigRepository } from '../prisma/repositories/PrismaConfigRepository';

// Services
import { ProductService } from '../../core/application/services/ProductService';
import { ConfigService } from '../../core/application/services/ConfigService';

// Prisma Client singleton
container.register<PrismaClient>(PrismaClient, {
  useClass: PrismaClient
}, { lifecycle: Lifecycle.Singleton });

// Product Repository & Service
container.register<IProductRepository>('IProductRepository', {
  useClass: PrismaProductRepository
}, { lifecycle: Lifecycle.Singleton });

container.register(ProductService, {
  useClass: ProductService
}, { lifecycle: Lifecycle.Singleton });

// Config Repository & Service
container.register<IConfigRepository>('IConfigRepository', {
  useClass: PrismaConfigRepository
}, { lifecycle: Lifecycle.Singleton });

container.register(ConfigService, {
  useClass: ConfigService
}, { lifecycle: Lifecycle.Singleton });

export { container };
