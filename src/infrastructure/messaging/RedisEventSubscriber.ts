import Redis from 'ioredis';
import { DomainEvent } from '../../core/domain/events/DomainEvent';

type EventHandler = (event: DomainEvent) => Promise<void>;

export class RedisEventSubscriber {
  private readonly redis: Redis;
  private readonly streamKey: string = 'events';
  private readonly consumerGroup: string = 'sigc-consumers';
  private readonly consumerName: string;
  private running: boolean = true;
  private handlers: Map<string, EventHandler[]> = new Map();

  constructor(consumerId: string, redisUrl?: string) {
    this.consumerName = `${consumerId}-${process.pid}-${Date.now()}`;
    this.redis = redisUrl ? new Redis(redisUrl) : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379'),
      retryStrategy: (times) => Math.min(times * 50, 2000)
    });
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    console.log(`📡 Suscrito a evento: ${eventType}`);
  }

  async start(): Promise<void> {
    console.log(`🔄 Iniciando subscriber: ${this.consumerName}`);
    
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.consumerGroup, '0', 'MKSTREAM');
    } catch (error) {
      // Consumer group already exists
    }

    while (this.running) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP',
          this.consumerGroup,
          this.consumerName,
          'COUNT',
          10,
          'BLOCK',
          1000,
          'STREAMS',
          this.streamKey,
          '>'
        );

        if (results && Array.isArray(results)) {
          for (const stream of results) {
            const streamId = stream[0];
            const messages = stream[1];
            for (const message of messages) {
              const messageId = message[0];
              const fields = message[1];
              const eventData = this.parseEvent(fields);
              if (eventData) {
                await this.processEvent(eventData);
                await this.redis.xack(this.streamKey, this.consumerGroup, messageId);
              }
            }
          }
        }
      } catch (error) {
        console.error('Error en subscriber:', error);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }

  private parseEvent(fields: string[]): DomainEvent | null {
    const eventIndex = fields.indexOf('event');
    if (eventIndex === -1) return null;
    
    try {
      const data = JSON.parse(fields[eventIndex + 1]);
      return {
        id: data.id,
        type: data.type,
        aggregateId: data.aggregateId,
        occurredAt: new Date(data.occurredAt),
        version: data.version,
        payload: data.payload,
        toJSON: () => data
      } as DomainEvent;
    } catch (error) {
      console.error('Error parseando evento:', error);
      return null;
    }
  }

  private async processEvent(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (handlers) {
      await Promise.all(handlers.map(handler => handler(event)));
    }
  }

  stop(): void {
    this.running = false;
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
