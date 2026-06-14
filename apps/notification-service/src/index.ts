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
