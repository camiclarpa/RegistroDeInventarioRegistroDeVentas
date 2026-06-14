import { Router } from 'express';
import { authenticate, authorize } from '../middleware/authMiddleware';
import * as ctrl from '../controllers/settingsController';

const router = Router();

// Middleware: todas las rutas requieren auth
const canManageSettings = [authenticate, authorize('admin')];

// ─── CONFIGURACIÓN DEL NEGOCIO ─────────────────────────────────────

/**
 * GET /api/v1/settings/business
 * Obtiene configuración actual
 */
router.get('/business', ...canManageSettings, ctrl.getBusinessSettings);

/**
 * PUT /api/v1/settings/business
 * Actualiza configuración
 */
router.put('/business', ...canManageSettings, ctrl.updateBusinessSettings);

/**
 * POST /api/v1/settings/logo
 * Actualiza ruta del logo
 */
router.post('/logo', ...canManageSettings, ctrl.updateLogo);

export default router;
