import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { IUserRepository } from '../../domain/repositories/IUserRepository';
import { User } from '../../domain/entities/User';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  expiresIn: string;
  user: {
    id: string;
    email: string;
    name: string;
    roleId: string;
  };
}

export class AuthService {
  private readonly jwtSecret: string;
  private readonly jwtExpiresIn: string | number;

  constructor(private readonly userRepo: IUserRepository) {
    this.jwtSecret = process.env.JWT_SECRET || 'secret-dev';
    this.jwtExpiresIn = process.env.JWT_EXPIRES_IN || '8h';
  }

  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const user = await this.userRepo.findByEmail(credentials.email);
    if (!user) {
      throw new Error('Credenciales inválidas');
    }

    // Verificar contraseña
    const isValid = await bcrypt.compare(credentials.password, user.password);
    if (!isValid) {
      throw new Error('Credenciales inválidas');
    }

    const token = jwt.sign(
      {
        userId: user.id,
        email: user.email.getValue(),
        roleId: user.roleId
      },
      this.jwtSecret,
      { expiresIn: this.jwtExpiresIn as jwt.SignOptions['expiresIn'] }
    );

    return {
      token,
      expiresIn: typeof this.jwtExpiresIn === 'number' ? `${this.jwtExpiresIn}s` : this.jwtExpiresIn,
      user: {
        id: user.id,
        email: user.email.getValue(),
        name: user.name,
        roleId: user.roleId
      }
    };
  }

  async validateToken(token: string): Promise<any> {
    try {
      const decoded = jwt.verify(token, this.jwtSecret);
      return decoded;
    } catch (error) {
      throw new Error('Token inválido o expirado');
    }
  }
}
