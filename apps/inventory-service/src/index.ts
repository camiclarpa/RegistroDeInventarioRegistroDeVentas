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

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date().toISOString() });
});

// Listar productos
app.get('/api/v1/products', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      take: 100,
      orderBy: { createdAt: 'desc' }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Obtener producto por ID
app.get('/api/v1/products/:id', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id }
    });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Stock bajo
app.get('/api/v1/products/low-stock', async (_req, res) => {
  try {
    const products = await prisma.product.findMany({
      where: {
        stockQuantity: { lte: prisma.product.fields.minStockLevel }
      }
    });
    res.json({ success: true, data: products });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Listar marcas
app.get('/api/v1/brands', async (_req, res) => {
  try {
    const brands = await prisma.brand.findMany();
    res.json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Listar categorías
app.get('/api/v1/categories', async (_req, res) => {
  try {
    const categories = await prisma.category.findMany();
    res.json({ success: true, data: categories });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`📦 Inventory service running on port ${PORT}`);
});
