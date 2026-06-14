import { User } from '../entities/User';

export interface IAuthRepository {
  findUserByEmail(email: string): Promise<User | null>;
  validatePassword(user: User, password: string): Promise<boolean>;
  saveRefreshToken(userId: string, token: string, expiresAt: Date): Promise<void>;
  validateRefreshToken(token: string): Promise<string | null>;
  revokeRefreshToken(token: string): Promise<void>;
}
