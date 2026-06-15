import client from 'prom-client';
import { Request, Response, NextFunction } from 'express';

// Crear registro
const register = new client.Registry();

// Métricas base
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

export const activeConnections = new client.Gauge({
    name: 'active_connections',
    help: 'Number of active connections',
    registers: [register]
});

// Métricas de negocio
export const productsCreated = new client.Counter({
    name: 'products_created_total',
    help: 'Total number of products created',
    registers: [register]
});

export const salesCompleted = new client.Counter({
    name: 'sales_completed_total',
    help: 'Total number of sales completed',
    labelNames: ['payment_method'],
    registers: [register]
});

// Middleware
export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    activeConnections.inc();
    
    res.on('finish', () => {
        const duration = (Date.now() - start) / 1000;
        const route = req.route?.path || req.path;
        
        httpRequestDuration.labels(req.method, route).observe(duration);
        httpRequestsTotal.labels(req.method, route, res.statusCode.toString()).inc();
        activeConnections.dec();
    });
    
    next();
};

// Endpoint de métricas
export const metricsEndpoint = async (_req: Request, res: Response) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
};
