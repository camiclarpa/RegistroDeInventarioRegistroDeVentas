import { Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { hashPassword, verifyPassword } from '../utils/passwordUtils';

const JWT_SECRET = process.env.JWT_SECRET || 'tu_secreto_super_seguro_cambialo';

const generateAccessToken = (user: any) => {
  return jwt.sign(
    { userId: user.id, email: user.email, role: user.roles?.name || 'user' },
    JWT_SECRET,
    { expiresIn: '15m' }
  );
};

const setRefreshCookie = (res: Response, token: string) => {
  res.cookie('refreshToken', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
};

export async function loginHandler(req: Request, res: Response): Promise<Response> {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, error: 'Email y contraseña requeridos' });
    }

    const user = await prisma.users.findUnique({
      where: { email: email.toLowerCase().trim() },
      include: { roles: true }
    });

    if (!user || !(await verifyPassword(password, user.password))) {
      return res.status(401).json({ success: false, error: 'Credenciales inválidas' });
    }

    const accessToken = generateAccessToken(user);
    const refreshToken = crypto.randomBytes(40).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refresh_tokens.create({
      data: { userId: user.id, token: refreshToken, expiresAt } as any,
    });

    setRefreshCookie(res, refreshToken);

    const { password: _, ...safeUser } = user;
    logger.info(`[auth] Login exitoso: ${user.email}`);

    return res.json({
      success: true,
      data: {
        token: accessToken,
        user: { id: safeUser.id, email: safeUser.email, name: safeUser.name, role: safeUser.roles?.name }
      }
    });
  } catch (error) {
    logger.error('[loginHandler]', error);
    return res.status(500).json({ success: false, error: 'Error interno del servidor' });
  }
}

export async function refreshTokenHandler(req: Request, res: Response): Promise<Response> {
  try {
    const refreshToken = req.cookies?.token;
    if (!refreshToken) {
      return res.status(401).json({ success: false, error: 'Refresh token no encontrado' });
    }

    const storedToken = await prisma.refresh_tokens.findFirst({
      where: { token: refreshToken, expiresAt: { gt: new Date() } },
      include: { users: { include: { roles: true } } }
    });

    if (!storedToken) {
      res.clearCookie('refreshToken');
      return res.status(401).json({ success: false, error: 'Sesión expirada' });
    }

    const newAccessToken = generateAccessToken(storedToken.users);
    const newRefreshToken = crypto.randomBytes(40).toString('hex');
    const newExpiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await prisma.refresh_tokens.update({
      where: { id: storedToken.id },
      data: { token: newRefreshToken, expiresAt: newExpiresAt } as any,
    });

    setRefreshCookie(res, newRefreshToken);
    return res.json({ success: true, data: { token: newAccessToken } });
  } catch (error) {
    logger.error('[refreshTokenHandler]', error);
    return res.status(500).json({ success: false, error: 'Error al renovar sesión' });
  }
}

export async function logoutHandler(req: Request, res: Response): Promise<Response> {
  try {
    const refreshToken = req.cookies?.token;
    if (refreshToken) {
      await prisma.refresh_tokens.deleteMany({ where: { token: refreshToken } });
    }
    res.clearCookie('refreshToken');
    return res.json({ success: true, message: 'Sesión cerrada' });
  } catch (error) {
    logger.error('[logoutHandler]', error);
    return res.status(500).json({ success: false, error: 'Error al cerrar sesión' });
  }
}
