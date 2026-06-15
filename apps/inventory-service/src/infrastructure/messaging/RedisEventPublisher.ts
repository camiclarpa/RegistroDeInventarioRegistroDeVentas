import Redis from 'ioredis';

export interface IEventPublisher {
  publish(event: any): Promise<void>;
  publishBatch(events: any[]): Promise<void>;
}

export class RedisEventPublisher implements IEventPublisher {
  private readonly redis: Redis;
  private readonly streamKey: string = 'events';

  constructor() {
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    console.log(`🔌 Conectando a Redis: ${redisUrl}`);
    this.redis = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      retryStrategy: (times) => {
        if (times > 3) {
          console.error('❌ No se pudo conectar a Redis después de 3 intentos');
          return null;
        }
        return Math.min(times * 100, 2000);
      }
    });
    
    this.redis.on('connect', () => console.log('✅ Redis conectado'));
    this.redis.on('error', (err) => console.error('❌ Redis error:', err.message));
  }

  async publish(event: any): Promise<void> {
    const message = JSON.stringify({
      id: event.id,
      type: event.type,
      aggregateId: event.aggregateId,
      occurredAt: event.occurredAt.toISOString(),
      version: event.version,
      payload: event.payload
    });
    
    await this.redis.xadd(
      this.streamKey,
      '*',
      'event',
      message,
      'type',
      event.type,
      'aggregateId',
      event.aggregateId
    );
    
    console.log(`📡 Evento publicado: ${event.type}`);
  }

  async publishBatch(events: any[]): Promise<void> {
    const pipeline = this.redis.pipeline();
    
    for (const event of events) {
      const message = JSON.stringify({
        id: event.id,
        type: event.type,
        aggregateId: event.aggregateId,
        occurredAt: event.occurredAt.toISOString(),
        version: event.version,
        payload: event.payload
      });
      pipeline.xadd(this.streamKey, '*', 'event', message, 'type', event.type, 'aggregateId', event.aggregateId);
    }
    
    await pipeline.exec();
    console.log(`📡 Batch publicado: ${events.length} eventos`);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
