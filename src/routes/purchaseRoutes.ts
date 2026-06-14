import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
// Handlers pendientes de implementar en purchaseController
// import {
//   registerEntryHandler,
//   getAllEntriesHandler,
//   getEntryByIdHandler
// } from '../controllers/purchaseController';

const router = Router();
const canRead = [authenticate, authorize('purchases.read')];
const canWrite = [authenticate, authorize('purchases.write')];

// Rutas de entradas - Pendientes de implementar
// router.post('/entries', ...canWrite, registerEntryHandler);
// router.get('/entries', ...canRead, getAllEntriesHandler);
// router.get('/entries/:id', ...canRead, getEntryByIdHandler);

export default router;

