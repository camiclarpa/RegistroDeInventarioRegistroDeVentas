import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { authenticate } from '../middleware/authMiddleware';
import { refreshTokenHandler } from '../controllers/authController';
import { logger } from '../config/logger';

const router = Router();

router.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    }

    const user = await prisma.users.findUnique({
      where: { email },
      include: { roles: true }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email,
        roleId: user.roleId,
        roleName: user.roles?.name
      },
      process.env.JWT_SECRET || 'secret-change-in-production',
      { expiresIn: '8h' }
    );

    res.json({
      success: true,
      data: {
        token,
        expiresIn: '8h',
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.roles?.name || 'user'
        }
      }
    });
  } catch (error) {
    logger.error('Login error:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

router.get('/me', authenticate, async (req: Request, res: Response) => {
  try {
    const userId = (req as any).user?.id;

    if (!userId) {
      return res.status(401).json({ success: false, error: 'No autenticado' });
    }

    const user = await prisma.users.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        roleId: true,
        isActive: true,
        roles: { select: { name: true } }
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, error: 'Usuario no encontrado' });
    }

    const permissions = await prisma.role_permissions.findMany({
      where: { roleId: user.roleId },
      select: { permissions: { select: { name: true } } }
    });

    res.json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.roles?.name || 'user',
          permissions: permissions.map((p: any) => p.permissions?.name).filter(Boolean)
        }
      }
    });
  } catch (error) {
    logger.error('Error en /auth/me:', error);
    res.status(500).json({ success: false, error: 'Error del servidor' });
  }
});

router.post('/refresh', refreshTokenHandler);
export default router;

