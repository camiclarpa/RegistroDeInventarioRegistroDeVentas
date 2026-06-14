import { rateLimit, ipKeyGenerator } from 'express-rate-limit';
import { logger } from '../config/logger';

/**
 * Helper para obtener IP normalizada (IPv4/IPv6 compatible)
 */
function getNormalizedIp(req: any): string {
  const rawIp = req.socket?.remoteAddress || req.ip || 'unknown';
  return ipKeyGenerator(rawIp);
}

/**
 * Rate Limiting para creación de productos
 */
export const productCreateRateLimit = rateLimit({
  windowMs: 1 * 1000,
  max: 10,
  message: { 
    success: false, 
    error: 'Demasiadas solicitudes de creación. Intenta en 1 segundo.', 
    retryAfter: 1 
  },
  standardHeaders: true,
  legacyHeaders: false,

  // ✅ CORREGIDO: ipKeyGenerator espera string (la IP), no Request
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id;
    if (userId) return `user:${userId}`;
    const rawIp = req.socket?.remoteAddress || req.ip || 'unknown';
    return `ip:${ipKeyGenerator(rawIp)}`;
  },

  handler: (req, res) => {
    const userId = (req.user as any)?.id;
    logger.warn('RATE_LIMIT_EXCEEDED', {
      endpoint: req.path,
      method: req.method,
      user_id: userId,
      ip: getNormalizedIp(req),
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      success: false,
      error: 'Demasiadas solicitudes. Por favor espera antes de intentar nuevamente.',
      retryAfter: 1,
    });
  },
  skip: () => false,
});

/**
 * Rate Limiting para importación masiva
 */
export const bulkImportRateLimit = rateLimit({
  windowMs: 10 * 1000,
  max: 1,
  message: {
    success: false,
    error: 'Importación masiva en progreso. Espera 10 segundos antes de otra importación.',
    retryAfter: 10,
  },
  standardHeaders: true,
  legacyHeaders: false,

  // ✅ CORREGIDO: mismo fix
  keyGenerator: (req) => {
    const userId = (req.user as any)?.id;
    if (userId) return `user:${userId}`;
    const rawIp = req.socket?.remoteAddress || req.ip || 'unknown';
    return `ip:${ipKeyGenerator(rawIp)}`;
  },

  handler: (req, res) => {
    const userId = (req.user as any)?.id;
    logger.warn('BULK_RATE_LIMIT_EXCEEDED', {
      endpoint: req.path,
      user_id: userId,
      ip: getNormalizedIp(req),
      timestamp: new Date().toISOString(),
    });
    res.status(429).json({
      success: false,
      error: 'Importación masiva en progreso. Espera antes de intentar nuevamente.',
      retryAfter: 10,
    });
  },
});
