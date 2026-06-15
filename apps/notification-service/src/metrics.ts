import client from 'prom-client';

const register = new client.Registry();

// Métricas por defecto
client.collectDefaultMetrics({ register });

// Métricas personalizadas
export const notificationsSent = new client.Counter({
  name: 'notifications_sent_total',
  help: 'Total number of notifications sent',
  labelNames: ['type'],
  registers: [register]
});

export const httpRequestsTotal = new client.Counter({
  name: 'http_requests_total',
  help: 'Total HTTP requests',
  labelNames: ['method', 'route', 'status'],
  registers: [register]
});

export const metricsEndpoint = async (_req: any, res: any) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};
