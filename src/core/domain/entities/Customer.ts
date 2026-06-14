import { Email } from '../value-objects/Email';
import { PhoneNumber } from '../value-objects/PhoneNumber';

export interface CreateCustomerParams {
  id?: string;
  name: string;
  phone?: string;
  email?: string;
  identificationNumber?: string;
  address?: string;
}

export class Customer {
  constructor(
    public readonly id: string,
    public readonly name: string,
    public readonly phone: PhoneNumber | null,
    public readonly email: Email | null,
    public readonly identificationNumber: string | null,
    public readonly address: string | null,
    public readonly isActive: boolean,
    public readonly loyaltyPoints: number,
    public readonly totalSpent: number,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(params: CreateCustomerParams): Customer {
    return new Customer(
      params.id || crypto.randomUUID(),
      params.name,
      params.phone ? PhoneNumber.create(params.phone) : null,
      params.email ? Email.create(params.email) : null,
      params.identificationNumber || null,
      params.address || null,
      true,
      0,
      0,
      new Date(),
      new Date()
    );
  }

  addLoyaltyPoints(points: number): Customer {
    return new Customer(
      this.id,
      this.name,
      this.phone,
      this.email,
      this.identificationNumber,
      this.address,
      this.isActive,
      this.loyaltyPoints + points,
      this.totalSpent,
      this.createdAt,
      new Date()
    );
  }

  updateTotalSpent(amount: number): Customer {
    return new Customer(
      this.id,
      this.name,
      this.phone,
      this.email,
      this.identificationNumber,
      this.address,
      this.isActive,
      this.loyaltyPoints,
      this.totalSpent + amount,
      this.createdAt,
      new Date()
    );
  }

  deactivate(): Customer {
    return new Customer(
      this.id,
      this.name,
      this.phone,
      this.email,
      this.identificationNumber,
      this.address,
      false,
      this.loyaltyPoints,
      this.totalSpent,
      this.createdAt,
      new Date()
    );
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      phone: this.phone?.getValue() || null,
      email: this.email?.getValue() || null,
      identificationNumber: this.identificationNumber,
      address: this.address,
      isActive: this.isActive,
      loyaltyPoints: this.loyaltyPoints,
      totalSpent: this.totalSpent,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
