import Redis from 'ioredis';
import { DomainEvent } from '../../core/domain/events/DomainEvent';

export interface IEventPublisher {
  publish(event: DomainEvent): Promise<void>;
  publishBatch(events: DomainEvent[]): Promise<void>;
}

export class RedisEventPublisher implements IEventPublisher {
  private readonly redis: Redis;
  private readonly streamKey: string = 'events';
  private readonly consumerGroup: string = 'sigc-consumers';

  constructor(redisUrl?: string) {
    this.redis = redisUrl ? new Redis(redisUrl) : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
  }

  async publish(event: DomainEvent): Promise<void> {
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
    
    console.log(`📡 Evento publicado: ${event.type} (${event.aggregateId})`);
  }

  async publishBatch(events: DomainEvent[]): Promise<void> {
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

  async createConsumerGroup(): Promise<void> {
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.consumerGroup, '0', 'MKSTREAM');
      console.log(`✅ Consumer group creado: ${this.consumerGroup}`);
    } catch (error) {
      // El grupo ya existe
    }
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
