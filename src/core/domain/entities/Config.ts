export interface BusinessConfig {
  id: string;
  businessName: string;
  nit: string;
  address: string;
  phone: string;
  email: string;
  taxRate: number;
  footer: string;
}

export class Config {
  constructor(
    public readonly id: string,
    public readonly businessName: string,
    public readonly nit: string,
    public readonly address: string,
    public readonly phone: string,
    public readonly email: string,
    public readonly taxRate: number,
    public readonly footer: string,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static fromPrisma(prismaConfig: any): Config {
    return new Config(
      prismaConfig.id,
      prismaConfig.businessName,
      prismaConfig.nit,
      prismaConfig.address,
      prismaConfig.phone,
      prismaConfig.email,
      Number(prismaConfig.taxRate),
      prismaConfig.footer,
      prismaConfig.createdAt,
      prismaConfig.updatedAt
    );
  }

  update(data: Partial<Omit<BusinessConfig, 'id' | 'createdAt'>>): Config {
    return new Config(
      this.id,
      data.businessName ?? this.businessName,
      data.nit ?? this.nit,
      data.address ?? this.address,
      data.phone ?? this.phone,
      data.email ?? this.email,
      data.taxRate ?? this.taxRate,
      data.footer ?? this.footer,
      this.createdAt,
      new Date()
    );
  }
}
