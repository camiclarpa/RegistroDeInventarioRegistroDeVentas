import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const prisma = new PrismaClient();

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date().toISOString() });
});

app.get('/api/v1/products', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({ take: 100 });
    res.json({ success: true, data: products });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

app.get('/api/v1/brands', async (_req, res) => {
  try {
    const brands = await prisma.brand.findMany();
    res.json({ success: true, data: brands });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

app.get('/api/v1/categories', async (_req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.json({ success: true, data: [] });
  }
});

app.listen(PORT, () => {
  console.log(`📦 Inventory service running on port ${PORT}`);
});
