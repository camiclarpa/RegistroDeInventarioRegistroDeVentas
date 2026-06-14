export interface TokenPayload {
  userId: string;
  email: string;
  roleId?: string;
  permissions?: string[];
}

export class AccessToken {
  constructor(
    public readonly value: string,
    public readonly expiresAt: Date,
    public readonly payload: TokenPayload
  ) {}

  isValid(): boolean {
    return new Date() < this.expiresAt;
  }
}

export class LoginCredentials {
  constructor(
    public readonly email: string,
    public readonly password: string
  ) {}

  validate(): boolean {
    return this.email.length > 0 && this.password.length >= 6;
  }
}

export class LoginResponse {
  constructor(
    public readonly accessToken: AccessToken,
    public readonly refreshToken: string,
    public readonly user: {
      id: string;
      email: string;
      name: string | null;
      roleId: string | null;
    }
  ) {}
}
