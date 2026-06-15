import client from 'prom-client';

const register = new client.Registry();

// Métricas por defecto (Node.js)
client.collectDefaultMetrics({ register });

// Métricas personalizadas
export const httpRequestsTotal = new client.Counter({
    name: 'inventory_http_requests_total',
    help: 'Total number of HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register]
});

export const httpRequestDuration = new client.Histogram({
    name: 'inventory_http_request_duration_seconds',
    help: 'Duration of HTTP requests in seconds',
    labelNames: ['method', 'route'],
    registers: [register],
    buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10]
});

export const productsCreated = new client.Counter({
    name: 'inventory_products_created_total',
    help: 'Total number of products created',
    registers: [register]
});

export const productsStock = new client.Gauge({
    name: 'inventory_products_stock_total',
    help: 'Total stock across all products',
    registers: [register]
});

export const productsLowStock = new client.Gauge({
    name: 'inventory_products_low_stock_total',
    help: 'Number of products with low stock',
    registers: [register]
});

export const eventsPublished = new client.Counter({
    name: 'inventory_events_published_total',
    help: 'Total number of events published',
    labelNames: ['event_type'],
    registers: [register]
});

export const activeConnections = new client.Gauge({
    name: 'inventory_active_connections',
    help: 'Number of active connections',
    registers: [register]
});

export const dbQueryDuration = new client.Histogram({
    name: 'inventory_db_query_duration_seconds',
    help: 'Duration of database queries in seconds',
    labelNames: ['operation'],
    registers: [register],
    buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1]
});

export const metricsEndpoint = async (_req: any, res: any) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
};
