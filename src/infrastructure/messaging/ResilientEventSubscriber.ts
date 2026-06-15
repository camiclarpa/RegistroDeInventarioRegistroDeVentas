import Redis from 'ioredis';
import { DomainEvent } from '../../core/domain/events/DomainEvent';
import { DeadLetterQueue } from './DeadLetterQueue';

type EventHandler = (event: DomainEvent) => Promise<void>;

export class ResilientEventSubscriber {
  private readonly redis: Redis;
  private readonly dlq: DeadLetterQueue;
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
    this.dlq = new DeadLetterQueue(redisUrl);
  }

  subscribe(eventType: string, handler: EventHandler): void {
    if (!this.handlers.has(eventType)) {
      this.handlers.set(eventType, []);
    }
    this.handlers.get(eventType)!.push(handler);
    console.log(`📡 Suscrito a evento: ${eventType}`);
  }

  async start(): Promise<void> {
    console.log(`🔄 Iniciando subscriber resiliente: ${this.consumerName}`);
    
    // Crear consumer group si no existe
    try {
      await this.redis.xgroup('CREATE', this.streamKey, this.consumerGroup, '0', 'MKSTREAM');
    } catch (error) {
      // Grupo ya existe
    }

    while (this.running) {
      try {
        const results = await this.redis.xreadgroup(
          'GROUP',
          this.consumerGroup,
          this.consumerName,
          'BLOCK',
          1000,
          'COUNT',
          10,
          'STREAMS',
          this.streamKey,
          '>'
        );

        if (results) {
          for (const [stream, messages] of results) {
            for (const [id, fields] of messages) {
              const eventData = this.parseEvent(fields);
              if (eventData) {
                const success = await this.processEventWithRetry(eventData);
                if (success) {
                  await this.redis.xack(this.streamKey, this.consumerGroup, id);
                } else {
                  await this.sendToDLQ(eventData, id);
                  await this.redis.xack(this.streamKey, this.consumerGroup, id);
                }
              } else {
                await this.redis.xack(this.streamKey, this.consumerGroup, id);
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

  private async processEventWithRetry(event: DomainEvent, retries: number = 3): Promise<boolean> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.processEvent(event);
        return true;
      } catch (error) {
        console.error(`Error procesando evento ${event.id} (intento ${attempt}/${retries}):`, error);
        if (attempt < retries) {
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }
    return false;
  }

  private async processEvent(event: DomainEvent): Promise<void> {
    const handlers = this.handlers.get(event.type);
    if (handlers && handlers.length > 0) {
      await Promise.all(handlers.map(handler => handler(event)));
    }
  }

  private async sendToDLQ(event: DomainEvent, streamId: string): Promise<void> {
    await this.dlq.send({
      id: event.id,
      originalEvent: event,
      error: 'Max retries exceeded',
      failedAt: new Date(),
      retryCount: 3,
      originalStream: streamId
    });
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

  stop(): void {
    this.running = false;
  }

  async close(): Promise<void> {
    await this.redis.quit();
    await this.dlq.close();
  }
}
