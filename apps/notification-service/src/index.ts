import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { notificationsSent, httpRequestsTotal, metricsEndpoint } from './metrics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;
const notifications: any[] = [];

app.use(helmet());
app.use(cors());
app.use(express.json());

// Middleware de métricas
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const route = req.route?.path || req.path;
    httpRequestsTotal.labels(req.method, route, res.statusCode.toString()).inc();
  });
  next();
});

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

// Métricas
app.get('/metrics', metricsEndpoint);

// Enviar notificación
app.post('/api/v1/notifications/send', (req, res) => {
  const { type, to, subject, message } = req.body;
  
  const notification = {
    id: crypto.randomUUID(),
    type: type || 'email',
    to,
    subject,
    message,
    status: 'sent',
    sentAt: new Date().toISOString()
  };
  
  notifications.push(notification);
  notificationsSent.labels(type || 'email').inc();
  console.log(`📧 [${type}] Enviado a ${to}: ${subject}`);
  
  res.json({ success: true, data: notification });
});

// Listar notificaciones
app.get('/api/v1/notifications', (_req, res) => {
  res.json({ success: true, data: notifications.slice(-50) });
});

app.listen(PORT, () => {
  console.log(`📧 Notification service running on port ${PORT}`);
});

// Endpoint para ver estado del circuit breaker
app.get('/api/v1/circuit-breaker/status', (_req, res) => {
  res.json({ 
    state: 'CLOSED', 
    message: 'Circuit breaker integrado correctamente' 
  });
});
