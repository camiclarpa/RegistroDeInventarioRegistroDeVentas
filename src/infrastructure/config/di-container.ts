import 'reflect-metadata';
import { container, Lifecycle } from 'tsyringe';
import { PrismaClient } from '@prisma/client';

// Repositories
import { IConfigRepository } from '../../core/domain/repositories/IConfigRepository';
import { PrismaConfigRepository } from '../prisma/repositories/PrismaConfigRepository';

// Services
import { ConfigService } from '../../core/application/services/ConfigService';

// Prisma Client singleton
container.register<PrismaClient>(PrismaClient, {
  useValue: new PrismaClient()
}, { lifecycle: Lifecycle.Singleton });

// Config Repository
container.register<IConfigRepository>('IConfigRepository', {
  useClass: PrismaConfigRepository
}, { lifecycle: Lifecycle.Singleton });

// Config Service
container.register(ConfigService, {
  useClass: ConfigService
}, { lifecycle: Lifecycle.Singleton });

export { container };
