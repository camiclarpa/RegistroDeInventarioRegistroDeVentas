import client from 'prom-client';

const register = new client.Registry();
client.collectDefaultMetrics({ register });

export const kpiRequests = new client.Counter({
  name: 'kpi_requests_total',
  help: 'Total number of KPI requests',
  registers: [register]
});

export const metricsEndpoint = async (_req: any, res: any) => {
  res.set('Content-Type', register.contentType);
  res.send(await register.metrics());
};
