import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import type { CreateCustomerInput, UpdateCustomerInput, SearchCustomersQuery } from '../utils/validators';

export async function createOrUpdateCustomer(data: CreateCustomerInput) {
  const existing = await prisma.customers.findFirst({
    where: {
      OR: [
        ...(data.identificationNumber ? [{ identificationNumber: data.identificationNumber }] : []),
        ...(data.phone ? [{ phone: data.phone }] : []),
      ],
    },
  });

  if (existing) {
    logger.info('Updating existing customer', { customerId: existing.id });
    return prisma.customers.update({
      where: { id: existing.id },
      data: {
        name: data.name,
        ...(data.phone !== undefined && { phone: data.phone }),
        ...(data.email !== undefined && { email: data.email }),
        ...(data.identificationNumber !== undefined && { identificationNumber: data.identificationNumber }),
        ...(data.address !== undefined && { address: data.address }),
      } as any,
    });
  }

  logger.info('Creating new customer', { name: data.name });
  return prisma.customers.create({ data: data as any });
}

export async function createNewCustomer(data: CreateCustomerInput) {
  logger.info('Creating new customer via CRM', { name: data.name });
  return prisma.customers.create({
    data: {
      name: data.name,
      phone: data.phone || null,
      email: data.email || null,
      identificationNumber: data.identificationNumber || null,
      address: data.address || null,
      loyaltyTier: 'BRONZE',
      loyaltyPoints: 0,
      totalSpent: 0,
      purchaseCount: 0,
      recency_days: 0,
      frequency_6m: 0,
      monetary_6m: 0,
      rfm_segment: 'REGULAR',
      credit_risk_score: 50,
    } as any,
  });
}

export async function getCustomerById(id: string) {
  return prisma.customers.findUnique({
    where: { id },
    include: {
      sales: {
        orderBy: { createdAt: 'desc' },
        take: 10,
        select: {
          id: true,
          saleNumber: true,
          totalAmount: true,
          status: true,
          createdAt: true,
        },
      },
    },
  });
}

export async function searchCustomers(query: SearchCustomersQuery) {
  const { page, limit, query: search } = query;
  const skip = (page - 1) * limit;

  const where: any = {
    isActive: true,
    ...(search && {
      OR: [
        { name: { contains: search, mode: 'insensitive' } },
        { phone: { contains: search, mode: 'insensitive' } },
        { identificationNumber: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ],
    }),
  };

  const [customers, total] = await prisma.$transaction([
    prisma.customers.findMany({
      where,
      skip,
      take: limit,
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        email: true,
        identificationNumber: true,
        address: true,
        createdAt: true,
      },
    }),
    prisma.customers.count({ where }),
  ]);

  return {
    data: customers,
    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
  };
}

export async function updateCustomer(id: string, data: UpdateCustomerInput) {
  return prisma.customers.update({ where: { id }, data: data as any });
}

