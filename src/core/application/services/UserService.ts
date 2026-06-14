import { User, CreateUserParams } from '../../domain/entities/User';
import { IUserRepository } from '../../domain/repositories/IUserRepository';

export class UserService {
  constructor(private readonly userRepo: IUserRepository) {}

  async createUser(params: CreateUserParams): Promise<User> {
    const existing = await this.userRepo.findByEmail(params.email);
    if (existing) {
      throw new Error(`User with email ${params.email} already exists`);
    }
    const user = User.create(params);
    await this.userRepo.save(user);
    return user;
  }

  async getUserById(id: string): Promise<User | null> {
    return this.userRepo.findById(id);
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepo.findByEmail(email);
  }

  async listUsers(page: number = 1, limit: number = 20): Promise<{
    items: User[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { items, total } = await this.userRepo.findAll(page, limit);
    return { items, total, page, limit };
  }

  async deactivateUser(id: string): Promise<User> {
    const user = await this.userRepo.findById(id);
    if (!user) {
      throw new Error(`User ${id} not found`);
    }
    const deactivated = user.deactivate();
    await this.userRepo.updateStatus(id, false);
    return deactivated;
  }
}
