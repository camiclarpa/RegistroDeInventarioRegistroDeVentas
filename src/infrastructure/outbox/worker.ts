import { PrismaClient } from '@prisma/client';
import { RedisEventPublisher } from '../messaging/RedisEventPublisher';

const prisma = new PrismaClient();
const publisher = new RedisEventPublisher();

async function processOutbox() {
    console.log('🔄 Outbox worker iniciado');
    
    while (true) {
        try {
            const events = await prisma.$queryRaw`
                SELECT * FROM outbox_events 
                WHERE status = 'pending' 
                ORDER BY created_at ASC 
                LIMIT 10
                FOR UPDATE SKIP LOCKED
            ` as any[];
            
            for (const event of events) {
                try {
                    await publisher.publish({
                        id: event.id,
                        type: event.event_type,
                        aggregateId: event.aggregate_id,
                        payload: event.payload,
                        occurredAt: event.created_at,
                        version: 1
                    } as any);
                    
                    await prisma.$executeRaw`
                        UPDATE outbox_events 
                        SET status = 'published', published_at = NOW()
                        WHERE id = ${event.id}
                    `;
                    console.log(`✅ Evento outbox publicado: ${event.event_type}`);
                } catch (error) {
                    await prisma.$executeRaw`
                        UPDATE outbox_events 
                        SET retry_count = retry_count + 1, last_error = ${(error as Error).message}
                        WHERE id = ${event.id}
                    `;
                    console.error(`❌ Error publicando evento outbox: ${event.id}`);
                }
            }
            
            await new Promise(resolve => setTimeout(resolve, 1000));
        } catch (error) {
            console.error('Outbox error:', error);
            await new Promise(resolve => setTimeout(resolve, 5000));
        }
    }
}

processOutbox();
