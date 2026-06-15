import { context, trace, Span, SpanStatusCode } from '@opentelemetry/api';
import { Express } from 'express';

export const tracingMiddleware = (req: any, res: any, next: any) => {
  const tracer = trace.getTracer('sigc-motos');
  const span = tracer.startSpan(`${req.method} ${req.path}`);
  
  span.setAttribute('http.method', req.method);
  span.setAttribute('http.url', req.url);
  span.setAttribute('http.user_agent', req.get('user-agent') || '');
  
  res.on('finish', () => {
    span.setAttribute('http.status_code', res.statusCode);
    if (res.statusCode >= 400) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: `HTTP ${res.statusCode}` });
    }
    span.end();
  });
  
  next();
};
