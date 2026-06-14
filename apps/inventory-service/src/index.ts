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

// Importar eventos
import { RedisEventPublisher } from '../../src/infrastructure/messaging/RedisEventPublisher';
import { StockUpdatedEvent, StockLowEvent } from '../../src/core/domain/events/InventoryEvents';

// Inicializar publisher
const eventPublisher = new RedisEventPublisher(process.env.REDIS_URL);

// Modificar updateStock para publicar evento
app.patch('/api/v1/products/:id/stock', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({ where: { id: req.params.id } });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const previousStock = product.stockQuantity;
    const newStock = previousStock + req.body.quantity;
    
    await prisma.product.update({
      where: { id: req.params.id },
      data: { stockQuantity: newStock, updatedAt: new Date() }
    });

    // Publicar evento de stock actualizado
    await eventPublisher.publish(new StockUpdatedEvent(
      product.id,
      {
        previousStock,
        newStock,
        quantityChanged: req.body.quantity,
        reason: req.body.reason || 'manual adjustment'
      }
    ));

    // Verificar stock bajo
    if (newStock <= product.minStockLevel) {
      await eventPublisher.publish(new StockLowEvent(
        product.id,
        {
          sku: product.skuInternal,
          name: product.nameCommercial,
          currentStock: newStock,
          minStockLevel: product.minStockLevel
        }
      ));
    }

    res.json({ success: true, data: { previousStock, newStock } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});
