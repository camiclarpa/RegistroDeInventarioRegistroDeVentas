import { User } from '../entities/User';

export interface IUserRepository {
  save(user: User): Promise<void>;
  findById(id: string): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  findAll(page: number, limit: number, filters?: any): Promise<{ items: User[]; total: number }>;
  updateStatus(id: string, isActive: boolean): Promise<void>;
}
