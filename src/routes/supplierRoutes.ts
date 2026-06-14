import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import * as supplierCtrl from '../controllers/supplierController';

const router = Router();

const canRead = [authenticate, authorize('purchases.read')];
const canWrite = [authenticate, authorize('purchases.write')];

// ⚠️ IMPORTANTE: Las rutas ESPECÍFICAS deben ir ANTES de las rutas con parámetros
// para que Express no las capture con /:id

// Rutas de colección (sin ID)
router.get('/', ...canRead, supplierCtrl.getSuppliers);
router.post('/', ...canWrite, supplierCtrl.createSupplier);

// Rutas ESPECÍFICAS (deben ir ANTES de /:id)
router.patch('/:id/reactivate', ...canWrite, supplierCtrl.reactivateSupplierHandler);
router.get('/:id/stats', ...canRead, supplierCtrl.getSupplierStats);

// Rutas genéricas con parámetro (van AL FINAL)
router.get('/:id', ...canRead, supplierCtrl.getSupplierById);
router.delete('/:id', ...canWrite, supplierCtrl.deactivateSupplierHandler);

export default router;
