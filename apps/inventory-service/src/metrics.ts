import client from 'prom-client';

const register = new client.Registry();

// Métricas por defecto
client.collectDefaultMetrics({ register });

// Métricas personalizadas
export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

export const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route'],
  registers: [register]
});

export const productsCreated = new client.Counter({
  name: 'products_created_total',
  help: 'Total number of products created',
  registers: [register]
});

export const eventsPublished = new client.Counter({
  name: 'events_published_total',
  help: 'Total number of events published',
  labelNames: ['event_type'],
  registers: [register]
});

export const activeConnections = new client.Gauge({
  name: 'active_connections',
  help: 'Number of active connections',
  registers: [register]
});

// Endpoint de métricas
export const metricsEndpoint = async (_req: any, res: any) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};
