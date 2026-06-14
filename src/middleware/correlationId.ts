import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

// Extender Express.Request para incluir correlationId (siguiendo patrón de authMiddleware)
declare global {
  namespace Express {
    interface Request {
      correlationId?: string;
    }
  }
}

/**
 * Middleware para generar/propagar Correlation ID
 * - Usa x-correlation-id del header si existe (trazabilidad cliente→servidor)
 * - Genera UUID v4 si no existe
 * - Agrega a req.correlationId para uso en logs y responses
 * - Agrega header X-Correlation-ID en response para trazabilidad
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction) {
  const correlationId = req.headers['x-correlation-id'] as string || uuidv4();
  req.correlationId = correlationId;
  res.setHeader('X-Correlation-ID', correlationId);
  next();
}

/**
 * Helper para obtener correlation ID desde request con fallback seguro
 */
export function getCorrelationId(req: Request): string {
  return req.correlationId || req.headers['x-correlation-id'] as string || 'unknown';
}
