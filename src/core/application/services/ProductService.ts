import { Product, CreateProductParams } from '../../domain/entities/Product';
import { IProductRepository } from '../../domain/repositories/IProductRepository';
import { RedisEventPublisher } from '../../../infrastructure/messaging/RedisEventPublisher';
import { ProductCreatedEvent } from '../../domain/events/InventoryEvents';

export class ProductService {
  private eventPublisher: RedisEventPublisher;

  constructor(private readonly productRepo: IProductRepository) {
    this.eventPublisher = new RedisEventPublisher();
  }

  async createProduct(params: CreateProductParams): Promise<Product> {
    const exists = await this.productRepo.exists(params.skuInternal);
    if (exists) {
      throw new Error(`Product with SKU ${params.skuInternal} already exists`);
    }

    const product = Product.create(params);
    await this.productRepo.save(product);
    
    // PUBLICAR EVENTO DE DOMINIO
    const event = new ProductCreatedEvent(product.id, {
      sku: product.sku.getValue(),
      name: product.name,
      price: product.salePrice.getValue(),
      stock: product.stockQuantity
    });
    await this.eventPublisher.publish(event);
    console.log(`📡 Evento publicado: ${event.type} - Producto ${product.name}`);
    
    return product;
  }

  async getProductById(id: string): Promise<Product | null> {
    return this.productRepo.findById(id);
  }

  async getProductBySKU(sku: string): Promise<Product | null> {
    return this.productRepo.findBySKU(sku);
  }

  async listProducts(filters: any, page: number = 1, limit: number = 20): Promise<any> {
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
