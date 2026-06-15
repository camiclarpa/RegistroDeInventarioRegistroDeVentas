import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3004;
const notifications: any[] = [];

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service', timestamp: new Date().toISOString() });
});

app.post('/api/v1/notifications/send', (req, res) => {
  const { type, to, subject, message } = req.body;
  const notification = {
    id: crypto.randomUUID(),
    type, to, subject, message,
    status: 'sent',
    sentAt: new Date().toISOString()
  };
  notifications.push(notification);
  console.log(`📧 [${type}] Enviado a ${to}: ${subject}`);
  res.json({ success: true, data: notification });
});

app.get('/api/v1/notifications', (_req, res) => {
  res.json({ success: true, data: notifications.slice(-50) });
});

app.listen(PORT, () => console.log(`📧 Notification service on port ${PORT}`));

// Importar subscriber de eventos
import { RedisEventSubscriber } from '../../src/infrastructure/messaging/RedisEventSubscriber';
import { DomainEvent } from '../../src/core/domain/events/DomainEvent';

// Inicializar subscriber
const subscriber = new RedisEventSubscriber('notification-service', process.env.REDIS_URL);

// Suscribirse a eventos de inventario
subscriber.subscribe('inventory.stock.low', async (event: DomainEvent) => {
  console.log(`⚠️ Alerta: Stock bajo en producto ${event.payload.name}`);
  console.log(`   SKU: ${event.payload.sku}, Stock actual: ${event.payload.currentStock}`);
  
  // Enviar notificación por email
  await fetch('http://localhost:3004/api/v1/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'email',
      to: 'admin@sigc.com',
      subject: `⚠️ Stock bajo: ${event.payload.name}`,
      message: `El producto ${event.payload.name} (${event.payload.sku}) tiene stock bajo: ${event.payload.currentStock} unidades.`
    })
  });
});

// Suscribirse a eventos de ventas
subscriber.subscribe('sale.completed', async (event: DomainEvent) => {
  console.log(`💰 Venta completada: ${event.payload.saleNumber}`);
  console.log(`   Total: $${event.payload.totalAmount}`);
  
  // Enviar notificación de venta exitosa
  await fetch('http://localhost:3004/api/v1/notifications/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'email',
      to: event.payload.customerId ? 'cliente@email.com' : 'admin@sigc.com',
      subject: `✅ Venta completada: ${event.payload.saleNumber}`,
      message: `Venta por $${event.payload.totalAmount} completada exitosamente.`
    })
  });
});

// Iniciar subscriber en segundo plano
subscriber.start().catch(console.error);

// Agregar endpoint para pruebas
app.post('/api/v1/events/test', async (req, res) => {
  const { eventType, payload } = req.body;
  console.log(`🧪 Evento de prueba: ${eventType}`, payload);
  res.json({ success: true, message: 'Evento recibido' });
});
