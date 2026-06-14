// Versión correcta con caché
import { prisma } from '../config/prisma';
import { cacheService } from './cacheService';

export async function getAllProductsWithCache(query: any) {
  const cacheKey = `products:list:${JSON.stringify(query)}`;

  // Intentar obtener del caché
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    console.log(`[Cache] HIT - ${cacheKey}`);
    return cached;
  }

  console.log(`[Cache] MISS - ${cacheKey}`);
  
  // Consultar BD - usar el modelo correcto 'products'
  const result = await prisma.products.findMany({
    where: query.where,
    skip: query.skip,
    take: query.take,
    orderBy: query.orderBy
  });

  // Guardar en caché por 5 minutos
  await cacheService.set(cacheKey, result, 300);

  return result;
}

