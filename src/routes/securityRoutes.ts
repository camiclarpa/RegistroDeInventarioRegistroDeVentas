/**
 * securityRoutes.ts — Módulo 7: Seguridad y Gobernanza
 *
 * Montado en /api/v1/security (autenticación aplicada en index.ts).
 */

import { Router } from 'express';
import { authorize } from '../middleware/authMiddleware';
import { requireRole } from '../middleware/rbacMiddleware';
import * as secCtrl from '../controllers/securityController';

const router = Router();

// ─── Gestión de contraseña ────────────────────────────────────────────────────
router.post('/change-password', secCtrl.changePassword);

// ─── Gestión de usuarios (ADMIN) ──────────────────────────────────────────────

// Listar usuarios
router.get('/users', requireRole('ADMIN'), secCtrl.listUsers);

// Crear usuario
router.post('/users', requireRole('ADMIN'), secCtrl.createUser);

// Actualizar usuario (general: nombre, email, rol, estado, contraseña)
//router.put('/users/:id', requireRole('ADMIN'), secCtrl.updateUser);

// Cambiar estado del usuario (activar/desactivar)
//router.patch('/users/:id/status', requireRole('ADMIN'), secCtrl.toggleUserStatus);

// Reactivar usuario (solo reactiva, no desactiva)
router.patch('/users/:id/reactivate', requireRole('ADMIN'), secCtrl.reactivateUser);

// Resetear contraseña por Admin
router.post('/users/:id/reset-password', requireRole('ADMIN'), secCtrl.resetUserPassword);

// ─── Auditoría ────────────────────────────────────────────────────────────────
router.get('/audit-logs', requireRole('ADMIN'), secCtrl.getAuditLogsPaginated);

// ─── Backup ───────────────────────────────────────────────────────────────────
router.post('/backup', requireRole('ADMIN'), secCtrl.triggerBackup);

export default router;
