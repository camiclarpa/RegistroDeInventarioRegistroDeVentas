import { PrismaClient } from '@prisma/client'

// Configuración mínima y compatible
const prisma = new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['query', 'error', 'warn'] : ['error'],
})

export { prisma }
