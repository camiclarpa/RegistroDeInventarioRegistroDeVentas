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
    const totalSales = await prisma.sale.count();
    const totalProducts = await prisma.product.count();
    const totalCustomers = await prisma.customer.count();
    
    res.json({
      success: true,
      data: { totalSales, totalProducts, totalCustomers, generatedAt: new Date().toISOString() }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

app.listen(PORT, () => console.log(`📊 Report service on port ${PORT}`));

// Importar subscriber de eventos
import { RedisEventSubscriber } from '../../src/infrastructure/messaging/RedisEventSubscriber';
import { DomainEvent } from '../../src/core/domain/events/DomainEvent';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const subscriber = new RedisEventSubscriber('report-service', process.env.REDIS_URL);

// Suscribirse a eventos de stock
subscriber.subscribe('inventory.stock.updated', async (event: DomainEvent) => {
  console.log(`📊 Registrando actualización de stock: ${event.payload.previousStock} → ${event.payload.newStock}`);
  
  // Aquí se podría almacenar en una tabla de auditoría
  // await prisma.stockAudit.create({ data: { ... } });
});

// Suscribirse a eventos de ventas para KPIs
subscriber.subscribe('sale.completed', async (event: DomainEvent) => {
  console.log(`📈 Actualizando KPIs: Venta ${event.payload.saleNumber} - $${event.payload.totalAmount}`);
  
  // Actualizar métricas en caché o base de datos
  // await updateKPIs(event.payload);
});

// Suscribirse a stock bajo para reportes
subscriber.subscribe('inventory.stock.low', async (event: DomainEvent) => {
  console.log(`📋 Reporte: Producto con stock bajo - ${event.payload.name}`);
});

// Iniciar subscriber
subscriber.start().catch(console.error);

// Endpoint mejorado de KPIs con datos en tiempo real
app.get('/api/v1/reports/kpis', async (_req, res) => {
  try {
    const [totalSales, totalProducts, totalCustomers] = await Promise.all([
      prisma.sale.count(),
      prisma.product.count(),
      prisma.customer.count()
    ]);
    
    res.json({
      success: true,
      data: {
        totalSales,
        totalProducts,
        totalCustomers,
        generatedAt: new Date().toISOString(),
        // Datos de eventos podrían venir de Redis
        events: {
          stockUpdated: await getEventCount('inventory.stock.updated'),
          salesCompleted: await getEventCount('sale.completed')
        }
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: (error as Error).message });
  }
});

async function getEventCount(eventType: string): Promise<number> {
  // Implementar conteo desde Redis
  return 0;
}
