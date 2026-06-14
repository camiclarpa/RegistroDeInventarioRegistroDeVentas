import { Request, Response } from 'express';
import { prisma } from '../config/prisma';
import { Prisma } from '@prisma/client';
import * as authService from '../services/authService';
import * as auditService from '../services/auditService';
import { logger } from '../config/logger';

const ok = (res: Response, data: unknown, status = 200) =>
  res.status(status).json({ success: true, data });

const fail = (res: Response, error: string, status = 400) =>
  res.status(status).json({ success: false, error });

function extractParam(param: string | string[] | undefined): string {
  if (Array.isArray(param)) return param[0] ?? '';
  return param ?? '';
}

function handleError(res: Response, err: unknown, context: string): Response {
  logger.error(`[userController] ${context}`, { err });

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') return fail(res, 'Ya existe un usuario con ese email', 409);
    if (err.code === 'P2025') return fail(res, 'Registro no encontrado', 404);
  }

  if (err instanceof Error) return fail(res, err.message, 400);
  return fail(res, 'Error interno del servidor', 500);
}

export async function login(req: Request, res: Response): Promise<Response> {
  try {
    const { email, password } = req.body as { email?: unknown; password?: unknown };

    if (typeof email !== 'string' || !email.trim()) {
      return fail(res, 'El campo email es requerido', 400);
    }
    if (typeof password !== 'string' || !password) {
      return fail(res, 'El campo password es requerido', 400);
    }

    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const result = await authService.login(email, password, ipAddress);
    return ok(res, result);
  } catch (err) {
    if (err instanceof Error && err.message === 'Credenciales inválidas') {
      return fail(res, err.message, 401);
    }
    return handleError(res, err, 'login');
  }
}

export async function getOwnProfile(req: Request, res: Response): Promise<Response> {
  const user = req.user!;
  return ok(res, {
    id: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: user.roleName,
    permissions: user.permissions,
  });
}

export async function createUser(req: Request, res: Response): Promise<Response> {
  try {
    const { email, password, name, roleId } = req.body as Record<string, unknown>;

    if (typeof email !== 'string' || !email.trim()) return fail(res, 'email requerido');
    if (typeof password !== 'string' || password.length < 6)
      return fail(res, 'password debe tener al menos 6 caracteres');
    if (typeof name !== 'string' || !name.trim()) return fail(res, 'name requerido');
    if (typeof roleId !== 'string' || !roleId.trim()) return fail(res, 'roleId requerido');

    const adminUserId = req.user!.id;
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const user = await authService.createUser({ email, password, name, roleId }, adminUserId, ipAddress);
    return ok(res, user, 201);
  } catch (err) {
    return handleError(res, err, 'createUser');
  }
}

export async function listUsers(_req: Request, res: Response): Promise<Response> {
  try {
    const users = await authService.listUsers();
    return ok(res, users);
  } catch (err) {
    return handleError(res, err, 'listUsers');
  }
}

export async function updateUserRole(req: Request, res: Response): Promise<Response> {
  try {
    const targetUserId = extractParam(req.params['id']);
    const { roleId } = req.body as { roleId?: unknown };

    if (!targetUserId) return fail(res, 'ID de usuario requerido');
    if (typeof roleId !== 'string' || !roleId.trim()) return fail(res, 'roleId requerido');

    if (targetUserId === req.user!.id) {
      return fail(res, 'No puedes cambiar tu propio rol', 403);
    }

    const adminUserId = req.user!.id;
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const updated = await authService.updateUserRole(targetUserId, roleId, adminUserId, ipAddress);
    return ok(res, updated);
  } catch (err) {
    return handleError(res, err, 'updateUserRole');
  }
}

export async function deactivateUser(req: Request, res: Response): Promise<Response> {
  try {
    const targetUserId = extractParam(req.params['id']);

    if (!targetUserId) return fail(res, 'ID de usuario requerido');
    if (targetUserId === req.user!.id) {
      return fail(res, 'No puedes desactivar tu propia cuenta', 403);
    }

    const adminUserId = req.user!.id;
    const ipAddress = req.ip ?? req.socket.remoteAddress;
    const user = await authService.deactivateUser(targetUserId, adminUserId, ipAddress);
    return ok(res, { message: 'Usuario desactivado correctamente', user });
  } catch (err) {
    return handleError(res, err, 'deactivateUser');
  }
}

export async function listRoles(_req: Request, res: Response): Promise<Response> {
  try {
    const roles = await authService.listRoles();
    return ok(res, roles);
  } catch (err) {
    return handleError(res, err, 'listRoles');
  }
}

export async function getAuditLogs(req: Request, res: Response): Promise<Response> {
  try {
    const { userId, entity, action, from, to, limit } = req.query;

    const logs = await auditService.getAuditLogs({
      userId: typeof userId === 'string' ? userId : undefined,
      entity: typeof entity === 'string' ? entity : undefined,
      action: typeof action === 'string' ? action : undefined,
      from: typeof from === 'string' ? new Date(from) : undefined,
      to: typeof to === 'string' ? new Date(to) : undefined,
      limit: typeof limit === 'string' ? parseInt(limit, 10) : 100,
    });

    return ok(res, logs);
  } catch (err) {
    return handleError(res, err, 'getAuditLogs');
  }
}

export async function meHandler(req: Request, res: Response) {
  try {
    const user = await prisma.users.findUnique({
      where: { id: req.user!.id },
      select: {
        id: true,
        name: true,
        email: true,
        roleId: true,
        roles: { select: { name: true } }
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, error: 'Usuario no encontrado' });
    }

    return res.json({
      success: true,
      data: {
        id: user.id,
        name: user.name,
        email: user.email,
        roleId: user.roleId,
        roleName: user.roles?.name,
        permissions: []
      }
    });
  } catch (error) {
    logger.error('[UserController] me error', error);
    return res.status(500).json({ success: false, error: 'Error interno' });
  }
}

