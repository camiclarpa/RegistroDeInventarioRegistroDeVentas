import { PrismaClient } from '@prisma/client';
import { RedisEventPublisher } from '../messaging/RedisEventPublisher';

export class OutboxService {
  private prisma: PrismaClient;
  private publisher: RedisEventPublisher;
  private running: boolean = true;

  constructor() {
    this.prisma = new PrismaClient();
    this.publisher = new RedisEventPublisher();
  }

  async store(eventType: string, aggregateId: string, payload: any): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO outbox_events (id, event_type, aggregate_id, payload, created_at)
      VALUES (gen_random_uuid(), ${eventType}, ${aggregateId}, ${JSON.stringify(payload)}::jsonb, NOW())
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
            await this.publisher.publish({
              id: event.id,
              type: event.event_type,
              aggregateId: event.aggregate_id,
              payload: event.payload,
              occurredAt: event.created_at,
              version: 1
            } as any);
            
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
