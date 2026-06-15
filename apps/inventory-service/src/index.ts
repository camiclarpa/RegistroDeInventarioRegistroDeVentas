import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import client from 'prom-client';
import Redis from 'ioredis';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3003;
const prisma = new PrismaClient();

// Configurar Redis
const redis = new Redis({
    host: process.env.REDIS_HOST || 'sigc_redis',
    port: parseInt(process.env.REDIS_PORT || '6379'),
    retryStrategy: (times) => {
        if (times > 3) return null;
        return Math.min(times * 100, 2000);
    }
});

redis.on('connect', () => console.log('✅ Redis conectado'));
redis.on('error', (err) => console.error('❌ Redis error:', err.message));

// Configurar métricas
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const httpRequestsTotal = new client.Counter({
    name: 'inventory_http_requests_total',
    help: 'Total HTTP requests',
    labelNames: ['method', 'route', 'status'],
    registers: [register]
});

const productsCreated = new client.Counter({
    name: 'inventory_products_created_total',
    help: 'Total products created',
    registers: [register]
});

// Middleware
app.use((req, res, next) => {
    res.on('finish', () => {
        const route = req.route?.path || req.path;
        httpRequestsTotal.labels(req.method, route, res.statusCode.toString()).inc();
    });
    next();
});

app.use(helmet());
app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'inventory-service', timestamp: new Date().toISOString() });
});

app.get('/metrics', async (_req, res) => {
    res.set('Content-Type', register.contentType);
    res.send(await register.metrics());
});

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

// Crear producto CON EVENTO AUTOMÁTICO
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
        
        productsCreated.inc();
        
        // PUBLICAR EVENTO AUTOMÁTICAMENTE
        const eventData = {
            id: crypto.randomUUID(),
            type: 'inventory.product.created',
            aggregateId: product.id,
            occurredAt: new Date().toISOString(),
            version: 1,
            payload: {
                sku: product.skuInternal,
                name: product.nameCommercial,
                price: product.salePriceBase,
                stock: product.stockQuantity
            }
        };
        
        console.log('📡 Publicando evento...');
        await redis.xadd(
            'events',
            '*',
            'event',
            JSON.stringify(eventData),
            'type',
            eventData.type,
            'aggregateId',
            eventData.aggregateId
        );
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
