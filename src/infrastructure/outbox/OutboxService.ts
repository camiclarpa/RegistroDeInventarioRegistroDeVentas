import { PrismaClient } from '@prisma/client';
import { RedisEventPublisher } from '../messaging/RedisEventPublisher';
import { DomainEvent } from '../../core/domain/events/DomainEvent';

export class OutboxService {
  private readonly prisma: PrismaClient;
  private readonly publisher: RedisEventPublisher;
  private running: boolean = true;

  constructor() {
    this.prisma = new PrismaClient();
    this.publisher = new RedisEventPublisher();
  }

  async store(event: DomainEvent): Promise<void> {
    // En producción, usar transacción con la operación de negocio
    await this.prisma.$executeRaw`
      INSERT INTO outbox_events (id, event_type, aggregate_id, payload, created_at)
      VALUES (${event.id}, ${event.type}, ${event.aggregateId}, ${JSON.stringify(event.payload)}::jsonb, NOW())
    `;
  }

  async processPending(): Promise<void> {
    while (this.running) {
      try {
        const events = await this.prisma.$queryRaw`
          SELECT * FROM outbox_events 
          WHERE status = 'pending' 
          ORDER BY created_at ASC 
          LIMIT 10
          FOR UPDATE SKIP LOCKED
        ` as any[];

        for (const event of events) {
          try {
            // Reconstruir evento y publicar
            const domainEvent = {
              id: event.id,
              type: event.event_type,
              aggregateId: event.aggregate_id,
              payload: event.payload,
              occurredAt: event.created_at,
              version: 1,
              toJSON: () => ({})
            } as DomainEvent;

            await this.publisher.publish(domainEvent);
            
            await this.prisma.$executeRaw`
              UPDATE outbox_events 
              SET status = 'published', published_at = NOW()
              WHERE id = ${event.id}
            `;
          } catch (error) {
            await this.prisma.$executeRaw`
              UPDATE outbox_events 
              SET retry_count = retry_count + 1, 
                  last_error = ${(error as Error).message}
              WHERE id = ${event.id}
            `;
          }
        }

        await new Promise(resolve => setTimeout(resolve, 1000));
      } catch (error) {
        console.error('Outbox error:', error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
  }

  start(): void {
    this.processPending();
  }

  stop(): void {
    this.running = false;
  }
}
