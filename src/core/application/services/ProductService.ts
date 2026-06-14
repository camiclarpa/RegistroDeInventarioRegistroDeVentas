import { Product, CreateProductParams } from '../../domain/entities/Product';
import { IProductRepository, ProductFilters, PaginatedResult } from '../../domain/repositories/IProductRepository';

export class ProductService {
  constructor(private readonly productRepo: IProductRepository) {}

  async createProduct(params: CreateProductParams): Promise<Product> {
    const exists = await this.productRepo.exists(params.skuInternal);
    if (exists) {
      throw new Error(`Product with SKU ${params.skuInternal} already exists`);
    }

    const product = Product.create(params);
    await this.productRepo.save(product);
    return product;
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.productRepo.findById(id);
  }

  async getProductBySKU(sku: string): Promise<Product | null> {
    return this.productRepo.findBySKU(sku);
  }

  async listProducts(filters: ProductFilters, page: number = 1, limit: number = 20): Promise<PaginatedResult<Product>> {
    return this.productRepo.findAll(filters, page, limit);
  }

  async updateStock(productId: string, quantity: number): Promise<void> {
    const product = await this.productRepo.findById(productId);
    if (!product) {
      throw new Error(`Product ${productId} not found`);
    }

    product.updateStock(quantity);
    await this.productRepo.updateStock(productId, product.stockQuantity);
  }

  async getLowStock(): Promise<Product[]> {
    return this.productRepo.findLowStock(5);
  }

  async deleteProduct(id: string): Promise<void> {
    const product = await this.productRepo.findById(id);
    if (!product) {
      throw new Error(`Product ${id} not found`);
    }
    await this.productRepo.delete(id);
  }
}
