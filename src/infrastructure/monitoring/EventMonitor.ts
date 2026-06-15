import Redis from 'ioredis';

export interface EventMetrics {
  totalPublished: number;
  totalConsumed: number;
  errors: number;
  latency: {
    p50: number;
    p95: number;
    p99: number;
  };
  byType: Record<string, {
    count: number;
    lastOccurrence: Date;
  }>;
}

export class EventMonitor {
  private readonly redis: Redis;
  private metrics: EventMetrics = {
    totalPublished: 0,
    totalConsumed: 0,
    errors: 0,
    latency: { p50: 0, p95: 0, p99: 0 },
    byType: {}
  };
  private latencies: number[] = [];

  constructor() {
    this.redis = new Redis({
      host: process.env.REDIS_HOST || 'localhost',
      port: parseInt(process.env.REDIS_PORT || '6379')
    });
  }

  recordPublished(eventType: string): void {
    this.metrics.totalPublished++;
    this.updateEventTypeStats(eventType);
  }

  recordConsumed(eventType: string, latencyMs: number): void {
    this.metrics.totalConsumed++;
    this.latencies.push(latencyMs);
    this.updateLatencyPercentiles();
    this.updateEventTypeStats(eventType);
  }

  recordError(eventType: string, error: Error): void {
    this.metrics.errors++;
    console.error(`❌ Event error [${eventType}]:`, error.message);
  }

  private updateLatencyPercentiles(): void {
    const sorted = [...this.latencies].sort((a, b) => a - b);
    const len = sorted.length;
    
    this.metrics.latency = {
      p50: sorted[Math.floor(len * 0.5)] || 0,
      p95: sorted[Math.floor(len * 0.95)] || 0,
      p99: sorted[Math.floor(len * 0.99)] || 0
    };
  }

  private updateEventTypeStats(eventType: string): void {
    if (!this.metrics.byType[eventType]) {
      this.metrics.byType[eventType] = {
        count: 0,
        lastOccurrence: new Date()
      };
    }
    this.metrics.byType[eventType].count++;
    this.metrics.byType[eventType].lastOccurrence = new Date();
  }

  async getMetrics(): Promise<EventMetrics> {
    // Obtener métricas adicionales de Redis
    const streamLength = await this.redis.xlen('events');
    
    return {
      ...this.metrics,
      streamLength
    } as any;
  }

  async reset(): Promise<void> {
    this.metrics = {
      totalPublished: 0,
      totalConsumed: 0,
      errors: 0,
      latency: { p50: 0, p95: 0, p99: 0 },
      byType: {}
    };
    this.latencies = [];
  }
}
