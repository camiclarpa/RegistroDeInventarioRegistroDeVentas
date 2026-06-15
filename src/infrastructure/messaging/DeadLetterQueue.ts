import Redis from 'ioredis';

export interface DeadLetterMessage {
  id: string;
  originalEvent: any;
  error: string;
  failedAt: Date;
  retryCount: number;
  originalStream: string;
}

export class DeadLetterQueue {
  private readonly redis: Redis;
  private readonly dlqKey: string = 'dead-letter-queue';
  private readonly maxRetries: number = 3;

  constructor(redisUrl?: string) {
    this.redis = redisUrl ? new Redis(redisUrl) : new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
  }

  async send(message: DeadLetterMessage): Promise<void> {
    const dlqMessage = {
      ...message,
      failedAt: message.failedAt.toISOString(),
      queue: this.dlqKey
    };

    await this.redis.lpush(this.dlqKey, JSON.stringify(dlqMessage));
    console.error(`💀 Mensaje enviado a DLQ: ${message.id} - ${message.error}`);
    
    // Notificar a admin
    await this.notifyAdmin(message);
  }

  async replay(messageId: string): Promise<boolean> {
    const messages = await this.redis.lrange(this.dlqKey, 0, -1);
    
    for (const msgStr of messages) {
      const msg = JSON.parse(msgStr);
      if (msg.id === messageId) {
        // Reintentar procesamiento
        await this.redis.rpush('replay-queue', JSON.stringify(msg.originalEvent));
        await this.redis.lrem(this.dlqKey, 1, msgStr);
        console.log(`🔄 Evento reenviado: ${messageId}`);
        return true;
      }
    }
    return false;
  }

  async getStats(): Promise<{ total: number; byError: Record<string, number> }> {
    const messages = await this.redis.lrange(this.dlqKey, 0, -1);
    const stats = {
      total: messages.length,
      byError: {} as Record<string, number>
    };

    for (const msgStr of messages) {
      const msg = JSON.parse(msgStr);
      const errorType = msg.error.split('\n')[0].substring(0, 50);
      stats.byError[errorType] = (stats.byError[errorType] || 0) + 1;
    }

    return stats;
  }

  async retryFailed(): Promise<void> {
    const messages = await this.redis.lrange(this.dlqKey, 0, -1);
    
    for (const msgStr of messages) {
      const msg = JSON.parse(msgStr);
      if (msg.retryCount < this.maxRetries) {
        msg.retryCount++;
        await this.redis.rpush('retry-queue', JSON.stringify(msg.originalEvent));
        await this.redis.lrem(this.dlqKey, 1, msgStr);
        console.log(`🔄 Reintentando evento: ${msg.id} (intento ${msg.retryCount})`);
      }
    }
  }

  private async notifyAdmin(message: DeadLetterMessage): Promise<void> {
    // Enviar alerta a admin
    console.error(`⚠️ ALERTA: Evento fallido en DLQ: ${message.id}`);
    console.error(`   Error: ${message.error}`);
    console.error(`   Evento original:`, message.originalEvent);
  }

  async close(): Promise<void> {
    await this.redis.quit();
  }
}
