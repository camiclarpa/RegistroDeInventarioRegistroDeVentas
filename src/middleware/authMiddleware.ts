import { Request, Response, NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

// JWT Config
const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-key-change-in-production';

// Extend Express Request type - INCLUIR TODAS LAS PROPIEDADES QUE EL SISTEMA ESPERA
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        email: string;
        name?: string;
        role?: string;           // Nombre del rol (ej: 'ADMIN')
        roleId?: string;         // ID del rol en la BD
        roleName?: string;       // Alias para roleName (compatibilidad)
        permissions?: string[];  // Lista de permisos explícitos
      };
    }
  }
}

/**
 * Middleware de autenticación - Verifica token JWT
 */
export function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader?.startsWith('Bearer ')) {
      return res.status(401).json({ success: false, error: 'Token no proporcionado' });
    }

    const token = authHeader.substring(7);
    const decoded = jwt.verify(token, JWT_SECRET) as any;

    // Adjuntar usuario al request CON TODAS LAS PROPIEDADES NECESARIAS
    req.user = {
      id: decoded.userId,
      email: decoded.email,
      name: decoded.name,
      role: decoded.role,
      roleId: decoded.roleId,
      roleName: decoded.roleName || decoded.role,  // Compatibilidad
      permissions: decoded.permissions || []
    };

    next();
  } catch (error) {
    logger.error('[AuthMiddleware] Authentication failed', error);
    return res.status(401).json({ success: false, error: 'Token inválido o expirado' });
  }
}

/**
 * Middleware de autorización - Verifica permisos
 * 
 * EN DESARROLLO (JWT_SECRET por defecto): Permite acceso si está autenticado
 * EN PRODUCCIÓN: Verifica permisos estrictamente
 */
export function authorize(...requiredPermissions: string[]) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      if (!req.user) {
        return res.status(401).json({ success: false, error: 'No autenticado' });
      }

      // MODO DESARROLLO: Permitir todo si usamos clave por defecto
      if (JWT_SECRET === 'dev-secret-key-change-in-production') {
        logger.debug(`[Authorize] Dev mode: allowing ${req.user.email}`);
        return next();
      }

      // MODO PRODUCCIÓN: Verificación estricta
      const userPermissions = req.user.permissions || [];
      
      // ADMIN tiene acceso total
      if (req.user.role === 'ADMIN' || req.user.roleName === 'ADMIN') {
        return next();
      }

      const hasPermission = requiredPermissions.some(perm => 
        userPermissions.includes(perm) || userPermissions.includes('*')
      );

      if (!hasPermission) {
        logger.warn(`[Authorize] Access denied for ${req.user.email}`);
        return res.status(403).json({ 
          success: false, 
          error: 'Acceso denegado: permisos insuficientes' 
        });
      }

      next();
    } catch (error) {
      logger.error('[AuthMiddleware] Authorization failed', error);
      return res.status(500).json({ success: false, error: 'Error de autorización' });
    }
  };
}
