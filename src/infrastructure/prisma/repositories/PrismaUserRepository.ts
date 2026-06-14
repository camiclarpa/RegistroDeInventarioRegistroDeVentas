import { PrismaClient } from '@prisma/client';
import { User } from '../../../core/domain/entities/User';
import { IUserRepository } from '../../../core/domain/repositories/IUserRepository';
import { Email } from '../../../core/domain/value-objects/Email';

export class PrismaUserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async save(user: User): Promise<void> {
    await this.prisma.users.upsert({
      where: { id: user.id },
      update: {
        email: user.email.getValue(),
        name: user.name,
        roleId: user.roleId,
        password: user.password,
        isActive: user.isActive,
        updatedAt: new Date()
      },
      create: {
        id: user.id,
        email: user.email.getValue(),
        name: user.name,
        roleId: user.roleId,
        password: user.password,
        isActive: user.isActive,
        createdAt: user.createdAt,
        updatedAt: user.updatedAt
      }
    });
  }

  async findById(id: string): Promise<User | null> {
    const record = await this.prisma.users.findUnique({
      where: { id }
    });
    return record ? this.toDomain(record) : null;
  }

  async findByEmail(email: string): Promise<User | null> {
    const record = await this.prisma.users.findUnique({
      where: { email }
    });
    return record ? this.toDomain(record) : null;
  }

  async findAll(page: number, limit: number, filters?: any): Promise<{ items: User[]; total: number }> {
    const skip = (page - 1) * limit;
    const [items, total] = await Promise.all([
      this.prisma.users.findMany({
        where: filters,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.users.count({ where: filters })
    ]);
    return { items: items.map(this.toDomain), total };
  }

  async updateStatus(id: string, isActive: boolean): Promise<void> {
    await this.prisma.users.update({
      where: { id },
      data: { isActive, updatedAt: new Date() }
    });
  }

  async updateRole(id: string, roleId: string): Promise<void> {
    await this.prisma.users.update({
      where: { id },
      data: { roleId, updatedAt: new Date() }
    });
  }

  async validatePassword(email: string, password: string): Promise<boolean> {
    const user = await this.findByEmail(email);
    if (!user) return false;
    return password === user.password; // Placeholder - usar bcrypt
  }

  private toDomain(record: any): User {
    return new User(
      record.id,
      Email.create(record.email),
      record.name,
      record.roleId,
      record.password,
      record.isActive,
      record.createdAt,
      record.updatedAt
    );
  }
}
