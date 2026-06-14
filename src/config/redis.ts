import { createClient, RedisClientType } from 'redis';
import { logger } from './logger';

// Cliente Redis con configuración compatible con @redis/client v4+
export const redis: RedisClientType = createClient({
  url: process.env.REDIS_URL || 'redis://sigc_redis:6379',
  socket: {
    reconnectStrategy: (retries: number) => {
      if (retries > 10) {
        logger.error('[Redis] Max retries reached');
        return new Error('Redis connection failed');
      }
      // Backoff exponencial: 100ms, 200ms, 400ms... max 3s
      return Math.min(retries * 100, 3000);
    },
    // keepAlive debe ser boolean, no número
    keepAlive: true,
  },
});

// Event listeners para logging
redis.on('error', (err: Error) => logger.error('[Redis] Client error', { error: err.message }));
redis.on('connect', () => logger.info('[Redis] Connected successfully'));
redis.on('ready', () => logger.info('[Redis] Ready for operations'));
redis.on('end', () => logger.warn('[Redis] Connection ended'));
redis.on('reconnecting', () => logger.info('[Redis] Reconnecting...'));

/**
 * Conectar Redis con manejo de errores robusto
 */
export async function connectRedis(): Promise<void> {
  try {
    // Solo conectar si no está ya abierto
    if (!redis.isOpen) {
      await redis.connect();
      logger.info('[Redis] Connection established');
    }
    
    // Ping periódico para mantener conexión activa (cada 30s)
    const keepAliveInterval = setInterval(async () => {
      try {
        if (redis.isReady) {
          await redis.ping();
        }
      } catch (e) {
        // Errores de ping son manejados por reconnectStrategy
        logger.debug('[Redis] Keep-alive ping failed', { error: e instanceof Error ? e.message : String(e) });
      }
    }, 30000);
    
    // Limpiar intervalo al cerrar el proceso
    process.on('beforeExit', () => clearInterval(keepAliveInterval));
    process.on('SIGTERM', () => {
      clearInterval(keepAliveInterval);
      redis.quit().catch(() => {});
    });
    
    logger.info('[Redis] Client connected and ready with keep-alive');
    
  } catch (error) {
    logger.error('[Redis] Failed to connect', { 
      error: error instanceof Error ? error.message : String(error) 
    });
    // No lanzar el error para no detener la app completa
    // Redis es opcional para funcionalidad básica
  }
}

/**
 * Desconectar Redis limpiamente
 */
export async function disconnectRedis(): Promise<void> {
  try {
    if (redis.isOpen) {
      await redis.quit();
      logger.info('[Redis] Disconnected gracefully');
    }
  } catch (error) {
    logger.error('[Redis] Error during disconnect', { 
      error: error instanceof Error ? error.message : String(error) 
    });
  }
}
