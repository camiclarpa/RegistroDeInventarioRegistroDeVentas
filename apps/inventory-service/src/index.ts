import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { RedisEventPublisher } from './infrastructure/messaging/RedisEventPublisher';
import { ProductCreatedEvent } from './core/domain/events/InventoryEvents';
import { 
  httpRequestsTotal, 
  httpRequestDuration, 
  productsCreated, 
  eventsPublished,
  activeConnections,
  metricsEndpoint 
} from './metrics';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const prisma = new PrismaClient();
const eventPublisher = new RedisEventPublisher();

// Middleware de métricas
app.use((req, res, next) => {
  const start = Date.now();
  activeConnections.inc();
  
  res.on('finish', () => {
    const duration = (Date.now() - start) / 1000;
    const route = req.route?.path || req.path;
    httpRequestDuration.labels(req.method, route).observe(duration);
    httpRequestsTotal.labels(req.method, route, res.statusCode.toString()).inc();
    activeConnections.dec();
  });
  
  next();
});

app.use(helmet());
app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date().toISOString() });
});

// Métricas
app.get('/metrics', metricsEndpoint);

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

// Crear producto con evento
app.post('/api/v1/products', async (req, res) => {
  try {
    console.log('📝 Creando producto...');
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
    
    // Incrementar métrica de productos creados
    productsCreated.inc();
    
    console.log('📡 Publicando evento...');
    const event = new ProductCreatedEvent(product.id, {
      sku: product.skuInternal,
      name: product.nameCommercial,
      price: product.salePriceBase,
      stock: product.stockQuantity
    });
    await eventPublisher.publish(event);
    eventsPublished.labels('inventory.product.created').inc();
    console.log('✅ Evento publicado');
    
    res.json({ success: true, data: product });
  } catch (error) {
    console.error('❌ Error:', error);
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.get('/api/v1/brands', async (_req, res) => {
  try {
    const brands = await prisma.brand.findMany();
    res.json({ success: true, data: brands });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

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
