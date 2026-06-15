import { Request, Response, NextFunction } from 'express';

// Métricas simples (sin dependencias externas)
const metrics: Record<string, any> = {
  http_requests_total: {},
  http_request_duration_seconds: [],
  active_connections: 0,
  errors_total: {}
};

export const metricsMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const start = Date.now();
  const route = req.route?.path || req.path;
  const method = req.method;

  // Incrementar contador de conexiones activas
  metrics.active_connections++;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;

    // Contar requests por ruta y método
    const key = `${method}:${route}`;
    metrics.http_requests_total[key] = (metrics.http_requests_total[key] || 0) + 1;

    // Registrar latencia
    metrics.http_request_duration_seconds.push({
      route,
      method,
      duration: duration / 1000,
      status,
      timestamp: new Date().toISOString()
    });

    // Mantener solo últimos 1000 registros
    if (metrics.http_request_duration_seconds.length > 1000) {
      metrics.http_request_duration_seconds.shift();
    }

    // Contar errores
    if (status >= 400) {
      const errorKey = `${key}:${status}`;
      metrics.errors_total[errorKey] = (metrics.errors_total[errorKey] || 0) + 1;
    }

    metrics.active_connections--;
  });

  next();
};

// Endpoint de métricas para Prometheus
export const metricsEndpoint = (_req: Request, res: Response) => {
  let metricLines = [];

  // http_requests_total
  Object.entries(metrics.http_requests_total).forEach(([labels, value]) => {
    const [method, route] = labels.split(':');
    metricLines.push(`http_requests_total{method="${method}",route="${route}"} ${value}`);
  });

  // active_connections
  metricLines.push(`active_connections ${metrics.active_connections}`);

  // errors_total
  Object.entries(metrics.errors_total).forEach(([labels, value]) => {
    const [method, route, status] = labels.split(':');
    metricLines.push(`errors_total{method="${method}",route="${route}",status="${status}"} ${value}`);
  });

  // Calcular latencia media (p95)
  const durations = metrics.http_request_duration_seconds.map((d: any) => d.duration);
  if (durations.length > 0) {
    durations.sort((a: number, b: number) => a - b);
    const p95Index = Math.floor(durations.length * 0.95);
    metricLines.push(`http_request_duration_p95_seconds ${durations[p95Index] || 0}`);
  }

  res.set('Content-Type', 'text/plain');
  res.send(metricLines.join('\n'));
};
