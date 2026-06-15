import Redis from 'ioredis-mock';
import { RedisEventPublisher } from '../../../src/infrastructure/messaging/RedisEventPublisher';
import { StockUpdatedEvent } from '../../../src/core/domain/events/InventoryEvents';

jest.mock('ioredis', () => require('ioredis-mock'));

describe('RedisEventPublisher', () => {
  let publisher: RedisEventPublisher;
  let mockRedis: any;

  beforeEach(() => {
    mockRedis = new Redis();
    publisher = new RedisEventPublisher();
    // @ts-ignore - reemplazar redis con mock
    publisher['redis'] = mockRedis;
  });

  afterEach(async () => {
    await publisher.close();
  });

  test('debe publicar evento correctamente', async () => {
    const event = new StockUpdatedEvent('product-123', {
      previousStock: 10,
      newStock: 5,
      quantityChanged: -5,
      reason: 'test'
    });
    
    await expect(publisher.publish(event)).resolves.not.toThrow();
  });

  test('debe publicar batch de eventos', async () => {
    const events = [
      new StockUpdatedEvent('product-1', { previousStock: 10, newStock: 5, quantityChanged: -5, reason: 'test' }),
      new StockUpdatedEvent('product-2', { previousStock: 20, newStock: 15, quantityChanged: -5, reason: 'test' })
    ];
    
    await expect(publisher.publishBatch(events)).resolves.not.toThrow();
  });
});
