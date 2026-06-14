import { Router } from 'express';
import chatRoutes from './crm/chat';

const router = Router();

// Rutas de CRM
router.use('/crm/chat', chatRoutes);

export default router;
