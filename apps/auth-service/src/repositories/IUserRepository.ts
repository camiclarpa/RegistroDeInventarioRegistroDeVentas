import { User } from '../domain/User';

export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(page: number, limit: number, filters?: any): Promise<{ items: User[]; total: number }>;
  updateStatus(id: string, isActive: boolean): Promise<void>;
  updateRole(id: string, roleId: string): Promise<void>;
  validatePassword(email: string, password: string): Promise<boolean>;
}
