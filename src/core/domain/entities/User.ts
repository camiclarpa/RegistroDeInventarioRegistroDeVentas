import { Email } from '../value-objects/Email';

export interface CreateUserParams {
  id?: string;
  email: string;
  name: string;
  roleId: string;
  isActive?: boolean;
}

export class User {
  constructor(
    public readonly id: string,
    public readonly email: Email,
    public readonly name: string,
    public readonly roleId: string,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(params: CreateUserParams): User {
    return new User(
      params.id || crypto.randomUUID(),
      Email.create(params.email),
      params.name,
      params.roleId,
      params.isActive ?? true,
      new Date(),
      new Date()
    );
  }

  deactivate(): User {
    return new User(
      this.id,
      this.email,
      this.name,
      this.roleId,
      false,
      this.createdAt,
      new Date()
    );
  }

  toJSON() {
    return {
      id: this.id,
      email: this.email.getValue(),
      name: this.name,
      roleId: this.roleId,
      isActive: this.isActive,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
