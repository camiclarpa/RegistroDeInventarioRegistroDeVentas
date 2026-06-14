import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { hashPassword, verifyPassword } from '../utils/passwordUtils';
import { logAction } from './auditService';
import { PERMISSIONS } from '../constants/permissions';

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) throw new Error('JWT_SECRET no está configurado');
  return secret;
}

function buildUserPayload(user: any) {
  const role = user.roles;
  const permissions = role?.role_permissions?.map((rp: any) => rp.permissions?.name) || [];
  return {
    userId: user.id,
    email: user.email,
    roleId: user.roleId,
    roleName: role?.name || 'USER',
    permissions,
  };
}

export async function login(email: string, password: string, ipAddress?: string) {
  const user = await prisma.users.findUnique({
    where: { email: email.toLowerCase().trim() },
    include: {
      roles: {
        include: {
          role_permissions: {
            include: { permissions: true }
          }
        }
      }
    },
  });

  const INVALID_MSG = 'Credenciales inválidas';
  if (!user || !user.isActive) throw new Error(INVALID_MSG);
  const valid = await verifyPassword(password, user.password);
  if (!valid) throw new Error(INVALID_MSG);

  const payload = buildUserPayload(user);
  const token = jwt.sign(payload, getJwtSecret(), { expiresIn: '8h' });
  await logAction(user.id, 'LOGIN', 'User', user.id, { email: user.email }, ipAddress);
  logger.info(`[authService] Login exitoso: ${user.email}`);

  const refreshToken = crypto.randomBytes(40).toString('hex');
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

  await prisma.refresh_tokens.create({
    data: { userId: user.id, token: refreshToken, expiresAt } as any,
  });

  return {
    token,
    refreshToken,
    expiresIn: '8h',
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.roles?.name || 'USER'
    }
  };
}

export interface CreateUserInput {
  email: string;
  password: string;
  name: string;
  roleId: string;
}

export async function createUser(data: CreateUserInput, adminUserId: string, ipAddress?: string) {
  const hashed = await hashPassword(data.password);
  const user = await prisma.users.create({
    data: {
      email: data.email.toLowerCase().trim(),
      password: hashed,
      name: data.name,
      roleId: data.roleId,
    } as any,
    include: { roles: { select: { id: true, name: true } } },
  });
  await logAction(adminUserId, 'CREATE_USER', 'User', user.id, { email: user.email, name: user.name, role: user.roles?.name }, ipAddress);
  logger.info(`[authService] Usuario creado: ${user.email} por admin ${adminUserId}`);
  const { password: _pw, ...safeUser } = user;
  return safeUser;
}

export async function listUsers() {
  return prisma.users.findMany({
    select: {
      id: true,
      email: true,
      name: true,
      isActive: true,
      createdAt: true,
      roles: { select: { id: true, name: true, description: true } }
    },
    orderBy: { createdAt: 'desc' },
  });
}

export async function updateUserRole(targetUserId: string, newRoleId: string, adminUserId: string, ipAddress?: string) {
  const user = await prisma.users.update({
    where: { id: targetUserId },
    data: { roleId: newRoleId },
    include: { roles: { select: { id: true, name: true } } },
  });
  await logAction(adminUserId, 'UPDATE_USER_ROLE', 'User', targetUserId, { newRoleId, newRoleName: user.roles?.name }, ipAddress);
  const { password: _pw, ...safeUser } = user;
  return safeUser;
}

export async function deactivateUser(targetUserId: string, adminUserId: string, ipAddress?: string) {
  const user = await prisma.users.update({
    where: { id: targetUserId },
    data: { isActive: false },
    select: { id: true, email: true, name: true },
  });
  await logAction(adminUserId, 'DEACTIVATE_USER', 'User', targetUserId, { email: user.email }, ipAddress);
  return user;
}

export async function reactivateUser(targetUserId: string, adminUserId: string, ipAddress?: string) {
  const user = await prisma.users.update({
    where: { id: targetUserId },
    data: { isActive: true },
    select: { id: true, email: true, name: true },
  });
  await logAction(adminUserId, 'REACTIVATE_USER', 'User', targetUserId, { email: user.email }, ipAddress);
  return user;
}

export async function listRoles() {
  return prisma.roles.findMany({
    select: {
      id: true,
      name: true,
      description: true,
      _count: { select: { users: true } }
    },
    orderBy: { name: 'asc' },
  });
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string, ipAddress?: string): Promise<void> {
  const user = await prisma.users.findUnique({
    where: { id: userId },
    select: { id: true, email: true, password: true, isActive: true }
  });
  if (!user || !user.isActive) throw new Error('Usuario no encontrado');
  const valid = await verifyPassword(oldPassword, user.password);
  if (!valid) throw new Error('La contraseña actual es incorrecta');
  if (oldPassword === newPassword) throw new Error('La nueva contraseña debe ser diferente a la actual');
  const hashed = await hashPassword(newPassword);
  await prisma.users.update({
    where: { id: userId },
    data: { password: hashed },
  });
  await logAction(userId, 'CHANGE_PASSWORD', 'User', userId, { email: user.email }, ipAddress);
  logger.info(`[authService] Contraseña cambiada: ${user.email}`);
}

export async function seedRolesAndPermissions() {
  const permissionKeys = Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[];
  const permissionsData = permissionKeys.map(key => ({
    name: PERMISSIONS[key],
    description: key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  }));

  for (const perm of permissionsData) {
    await prisma.permissions.upsert({
      where: { name: perm.name },
      update: {},
      create: perm as any,
    });
  }

  const defaultRoles = [
    { name: 'ADMIN', description: 'Administrador del sistema' },
    { name: 'SELLER', description: 'Vendedor' },
    { name: 'WAREHOUSE', description: 'Almacén' },
  ];

  for (const roleData of defaultRoles) {
    const role = await prisma.roles.upsert({
      where: { name: roleData.name },
      update: {},
      create: roleData as any,
    });

    const permObjects = await prisma.permissions.findMany({
      where: { name: { in: Object.values(PERMISSIONS) } },
      select: { id: true }
    });

    if (permObjects.length > 0) {
      await prisma.role_permissions.createMany({
        data: permObjects.map(p => ({ roleId: role.id, permissionId: p.id })),
        skipDuplicates: true,
      });
    }
  }
  logger.info('[authService] Roles y permisos sembrados correctamente');
}

