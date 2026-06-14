import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import * as reportController from '../controllers/reportController';

const router = Router();

// Todas las rutas requieren autenticación + permiso reports.read
router.use(authenticate, authorize('reports.read'));

// ─── Dashboard y Rentabilidad ───────────────────────────────────────────────
router.get('/dashboard', reportController.getDashboard);
router.get('/profitability', reportController.getProfitability);
router.get('/dashboard/executive', reportController.getExecutiveDashboard);

// ─── Inventario ─────────────────────────────────────────────────────────────
router.get('/inventory/aging', reportController.getInventoryAging);
router.get('/inventory/valuation', reportController.getInventoryValuation);

// ─── Ventas y Análisis ABC ──────────────────────────────────────────────────
router.get('/sales/grouped', reportController.getSalesGrouped);
router.get('/products/rotation', reportController.getProductRotationAnalysis);

// ─── Clientes y Proveedores ─────────────────────────────────────────────────
router.get('/customers/top-buyers', reportController.getTopCustomers);
router.get('/suppliers/performance', reportController.getSupplierPerformance);
router.get('/alerts/low-stock', reportController.getLowStockAlerts);

// ─── Exportación Excel ──────────────────────────────────────────────────────
router.get('/export/:type', reportController.exportReport);

export default router;
