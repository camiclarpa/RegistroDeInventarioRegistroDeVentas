import { cacheService } from './cacheService';

export async function getDashboardWithCache(startDate?: Date, endDate?: Date) {
  const cacheKey = `dashboard:${startDate?.toISOString() || 'default'}:${endDate?.toISOString() || 'default'}`;
  
  const cached = await cacheService.get(cacheKey);
  if (cached) {
    console.log(`[Cache] Dashboard HIT`);
    return cached;
  }
  
  console.log(`[Cache] Dashboard MISS`);
  const { getDashboardStats } = await import('./reportService');
  const result = await getDashboardStats(startDate, endDate);
  
  // Dashboard se cachea por 1 minuto (más corto por ser datos en tiempo real)
  await cacheService.set(cacheKey, result, 60);
  
  return result;
}
