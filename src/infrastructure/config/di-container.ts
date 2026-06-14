import 'reflect-metadata';
import { container, Lifecycle } from 'tsyringe';
import { PrismaClient } from '@prisma/client';

// Repositories
import { IConfigRepository } from '../../core/domain/repositories/IConfigRepository';
import { IProductRepository } from '../../core/domain/repositories/IProductRepository';
import { ISaleRepository } from '../../core/domain/repositories/ISaleRepository';
import { ICustomerRepository } from '../../core/domain/repositories/ICustomerRepository';
import { IUserRepository } from '../../core/domain/repositories/IUserRepository';
import { PrismaConfigRepository } from '../prisma/repositories/PrismaConfigRepository';
import { PrismaProductRepository } from '../prisma/repositories/PrismaProductRepository';
import { PrismaSaleRepository } from '../prisma/repositories/PrismaSaleRepository';
import { PrismaCustomerRepository } from '../prisma/repositories/PrismaCustomerRepository';
import { PrismaUserRepository } from '../prisma/repositories/PrismaUserRepository';

// Services
import { ConfigService } from '../../core/application/services/ConfigService';
import { ProductService } from '../../core/application/services/ProductService';
import { SaleService } from '../../core/application/services/SaleService';
import { CustomerService } from '../../core/application/services/CustomerService';
import { UserService } from '../../core/application/services/UserService';

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

// Customer
container.register<ICustomerRepository>('ICustomerRepository', {
  useClass: PrismaCustomerRepository
}, { lifecycle: Lifecycle.Singleton });
container.register(CustomerService, { useClass: CustomerService }, { lifecycle: Lifecycle.Singleton });

// User
container.register<IUserRepository>('IUserRepository', {
  useClass: PrismaUserRepository
}, { lifecycle: Lifecycle.Singleton });
container.register(UserService, { useClass: UserService }, { lifecycle: Lifecycle.Singleton });

export { container };
