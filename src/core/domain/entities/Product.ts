import { Money } from '../value-objects/Money';
import { SKU } from '../value-objects/SKU';

export interface CreateProductParams {
  id?: string;
  skuInternal: string;
  nameCommercial: string;
  brandId: string;
  categoryId: string;
  costPriceAvg: number;
  salePriceBase: number;
  stockQuantity: number;
  minStockLevel: number;
}

export class Product {
  private constructor(
    public readonly id: string,
    public readonly sku: SKU,
    public readonly name: string,
    public readonly brandId: string,
    public readonly categoryId: string,
    public readonly costPrice: Money,
    public readonly salePrice: Money,
    private _stockQuantity: number,
    public readonly minStockLevel: number,
    public readonly isActive: boolean,
    public readonly createdAt: Date,
    public readonly updatedAt: Date
  ) {}

  static create(params: CreateProductParams): Product {
    return new Product(
      params.id || crypto.randomUUID(),
      new SKU(params.skuInternal),
      params.nameCommercial,
      params.brandId,
      params.categoryId,
      new Money(params.costPriceAvg, 'COP'),
      new Money(params.salePriceBase, 'COP'),
      params.stockQuantity,
      params.minStockLevel,
      true,
      new Date(),
      new Date()
    );
  }

  get stockQuantity(): number {
    return this._stockQuantity;
  }

  isLowStock(): boolean {
    return this._stockQuantity <= this.minStockLevel;
  }

  isCriticalStock(): boolean {
    return this._stockQuantity <= this.minStockLevel / 2;
  }

  canBeSold(quantity: number): boolean {
    return this.isActive && this._stockQuantity >= quantity;
  }

  updateStock(change: number): Product {
    const newStock = this._stockQuantity + change;
    if (newStock < 0) {
      throw new Error(`Insufficient stock for product ${this.id}. Available: ${this._stockQuantity}, Requested: ${-change}`);
    }
    
    return new Product(
      this.id,
      this.sku,
      this.name,
      this.brandId,
      this.categoryId,
      this.costPrice,
      this.salePrice,
      newStock,
      this.minStockLevel,
      this.isActive,
      this.createdAt,
      new Date()
    );
  }

  calculateProfitMargin(): number {
    const cost = this.costPrice.getValue();
    const price = this.salePrice.getValue();
    if (cost === 0) return 0;
    return ((price - cost) / cost) * 100;
  }

  toJSON() {
    return {
      id: this.id,
      sku: this.sku.getValue(),
      name: this.name,
      brandId: this.brandId,
      categoryId: this.categoryId,
      costPrice: this.costPrice.getValue(),
      salePrice: this.salePrice.getValue(),
      stockQuantity: this._stockQuantity,
      minStockLevel: this.minStockLevel,
      isLowStock: this.isLowStock(),
      isCriticalStock: this.isCriticalStock(),
      profitMargin: this.calculateProfitMargin(),
      isActive: this.isActive,
      createdAt: this.createdAt.toISOString(),
      updatedAt: this.updatedAt.toISOString()
    };
  }
}
