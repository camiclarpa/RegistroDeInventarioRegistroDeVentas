import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'report-service', timestamp: new Date().toISOString() });
});

app.get('/api/v1/reports/kpis', async (_req, res) => {
  try {
    const totalProducts = await prisma.product.count();
    res.json({ success: true, data: { totalProducts, generatedAt: new Date().toISOString() } });
  } catch (error) {
    res.json({ success: true, data: { totalProducts: 0, generatedAt: new Date().toISOString() } });
  }
});

app.listen(PORT, () => {
  console.log(`📊 Report service running on port ${PORT}`);
});
