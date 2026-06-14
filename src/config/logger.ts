import winston from 'winston';
import { Request } from 'express';

// Formato personalizado que incluye correlation_id y contexto de request
const correlationFormat = winston.format.printf(({ level, message, timestamp, correlation_id, user_id, endpoint, ip, method, stack, ...meta }) => {
  const logEntry: Record<string, unknown> = {
    level,
    message,
    timestamp,
  };
  
  // Agregar campos opcionales solo si existen (evitar null/undefined en JSON)
  if (correlation_id) logEntry.correlation_id = correlation_id;
  if (user_id) logEntry.user_id = user_id;
  if (endpoint) logEntry.endpoint = endpoint;
  if (ip) logEntry.ip = ip;
  if (method) logEntry.method = method;
  if (stack) logEntry.stack = stack;
  
  // Agregar metadata adicional si existe
  if (Object.keys(meta).length > 0) {
    logEntry.meta = meta;
  }
  
  return JSON.stringify(logEntry);
});

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    correlationFormat,
  ),
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production' 
        ? correlationFormat 
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple(),
          ),
    }),
    new winston.transports.File({ 
      filename: 'logs/error.log', 
      level: 'error',
      format: correlationFormat,
    }),
    new winston.transports.File({ 
      filename: 'logs/combined.log',
      format: correlationFormat,
    }),
  ],
});

/**
 * Helper para loggear con contexto de request
 * Uso: logWithContext('info', 'Mensaje', req, { extra: 'data' })
 */
export function logWithContext(
  level: 'info' | 'warn' | 'error',
  message: string,
  req?: Request,
  meta?: Record<string, unknown>
) {
  const context: Record<string, unknown> = { message, ...(meta || {}) };
  
  if (req) {
    context.correlation_id = req.correlationId;
    context.user_id = (req.user as any)?.id;
    context.endpoint = req.path;
    context.method = req.method;
    context.ip = req.ip;
  }
  
  logger[level](context);
}

// Exportar helpers convenientes
export const logInfo = (message: string, req?: Request, meta?: Record<string, unknown>) => 
  logWithContext('info', message, req, meta);
export const logWarn = (message: string, req?: Request, meta?: Record<string, unknown>) => 
  logWithContext('warn', message, req, meta);
export const logError = (message: string, req?: Request, meta?: Record<string, unknown>) => 
  logWithContext('error', message, req, meta);
