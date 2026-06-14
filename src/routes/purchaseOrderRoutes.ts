import { Router } from 'express';
import {
  listPurchaseOrdersHandler,
  getPurchaseOrderByIdHandler,
  createPurchaseOrderHandler,
  updatePurchaseOrderHandler,
  receivePurchaseOrderHandler,
} from '../controllers/purchaseController';
import { authenticate, authorize } from '../middleware/authMiddleware';

const router = Router();
const canRead = [authenticate, authorize('purchases.read')];
const canWrite = [authenticate, authorize('purchases.write')];

// Rutas ESPECÍFICAS
router.post('/:id/receive', ...canWrite, receivePurchaseOrderHandler);
// router.post('/:id/cancel', ...canWrite, cancelPurchaseOrderHandler); // Pendiente de implementar
// router.get('/:id/pdf', ...canRead, downloadPurchaseOrderPDFHandler); // Pendiente de implementar

// Rutas CRUD ESTÁNDAR
router.get('/:id', ...canRead, getPurchaseOrderByIdHandler);
router.put('/:id', ...canWrite, updatePurchaseOrderHandler);
router.get('/', ...canRead, listPurchaseOrdersHandler);
router.post('/', ...canWrite, createPurchaseOrderHandler);

export default router;

