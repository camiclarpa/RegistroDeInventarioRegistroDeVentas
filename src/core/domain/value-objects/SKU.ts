export class SKU {
  private constructor(private readonly value: string) {}

  static create(sku: string): SKU {
    if (!SKU.isValid(sku)) {
      throw new Error(`Invalid SKU format: ${sku}. Must be 3-20 alphanumeric characters.`);
    }
    return new SKU(sku.toUpperCase());
  }

  static isValid(sku: string): boolean {
    return /^[A-Z0-9]{3,20}$/.test(sku);
  }

  getValue(): string {
    return this.value;
  }

  equals(other: SKU): boolean {
    return this.value === other.value;
  }
}
