import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { RedisEventPublisher } from './infrastructure/messaging/RedisEventPublisher';
import { ProductCreatedEvent, StockUpdatedEvent, StockLowEvent } from './core/domain/events/InventoryEvents';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const prisma = new PrismaClient();
const eventPublisher = new RedisEventPublisher();

app.use(helmet());
app.use(cors());
app.use(express.json());

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

// Crear producto con evento AUTOMÁTICO
app.post('/api/v1/products', async (req, res) => {
  try {
    const product = await prisma.product.create({
      data: {
        id: crypto.randomUUID(),
        skuInternal: req.body.skuInternal,
        partNumberOEM: req.body.partNumberOEM || 'N/A',
        brandId: req.body.brandId,
        categoryId: req.body.categoryId,
        nameCommercial: req.body.nameCommercial,
        locationBin: req.body.locationBin || 'DEFAULT',
        costPriceAvg: req.body.costPriceAvg || 0,
        salePriceBase: req.body.salePriceBase || 0,
        stockQuantity: req.body.stockQuantity || 0,
        minStockLevel: req.body.minStockLevel || 5,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    });
    
    // EVENTO AUTOMÁTICO
    const event = new ProductCreatedEvent(product.id, {
      sku: product.skuInternal,
      name: product.nameCommercial,
      price: product.salePriceBase,
      stock: product.stockQuantity
    });
    await eventPublisher.publish(event);
    
    res.json({ success: true, data: product });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

// Actualizar stock con evento automático
app.patch('/api/v1/products/:id/stock', async (req, res) => {
  try {
    const product = await prisma.product.findUnique({
      where: { id: req.params.id }
    });
    if (!product) {
      return res.status(404).json({ success: false, error: 'Product not found' });
    }

    const previousStock = product.stockQuantity;
    const newStock = previousStock + (req.body.quantity || 0);
    
    await prisma.product.update({
      where: { id: req.params.id },
      data: { stockQuantity: newStock, updatedAt: new Date() }
    });

    // Evento de stock actualizado
    const stockEvent = new StockUpdatedEvent(product.id, {
      previousStock,
      newStock,
      quantityChanged: req.body.quantity || 0,
      reason: req.body.reason || 'stock adjustment'
    });
    await eventPublisher.publish(stockEvent);

    // Evento de stock bajo si aplica
    if (newStock <= product.minStockLevel) {
      const lowStockEvent = new StockLowEvent(product.id, {
        sku: product.skuInternal,
        name: product.nameCommercial,
        currentStock: newStock,
        minStockLevel: product.minStockLevel
      });
      await eventPublisher.publish(lowStockEvent);
    }

    res.json({ success: true, data: { previousStock, newStock } });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.listen(PORT, () => {
  console.log(`📦 Inventory service running on port ${PORT}`);
});
