import { Product, CreateProductParams } from '../../domain/entities/Product';
import { IProductRepository, ProductFilters, PaginatedResult } from '../../domain/repositories/IProductRepository';
import { RedisEventPublisher } from '../../../infrastructure/messaging/RedisEventPublisher';
import { ProductCreatedEvent } from '../../domain/events/InventoryEvents';
import { CreateProductDTO, ProductResponseDTO } from '../dtos/ProductDTO';

export class ProductService {
  private eventPublisher: RedisEventPublisher;

  constructor(private readonly productRepo: IProductRepository) {
    this.eventPublisher = new RedisEventPublisher();
  }

  async createProduct(dto: CreateProductDTO): Promise<ProductResponseDTO> {
    const exists = await this.productRepo.exists(dto.skuInternal);
    if (exists) {
      throw new Error(`Product with SKU ${dto.skuInternal} already exists`);
    }

    const params: CreateProductParams = {
      skuInternal: dto.skuInternal,
      nameCommercial: dto.nameCommercial,
      brandId: dto.brandId,
      categoryId: dto.categoryId,
      costPriceAvg: dto.costPriceAvg,
      salePriceBase: dto.salePriceBase,
      stockQuantity: dto.stockQuantity || 0,
      minStockLevel: dto.minStockLevel || 5
    };

    const product = Product.create(params);
    await this.productRepo.save(product);
    
    const event = new ProductCreatedEvent(product.id, {
      sku: product.sku.getValue(),
      name: product.name,
      price: product.salePrice.getValue(),
      stock: product.stockQuantity
    });
    await this.eventPublisher.publish(event);
    
    return this.toResponseDTO(product);
  }

  async getProductById(id: string): Promise<ProductResponseDTO | null> {
    const product = await this.productRepo.findById(id);
    return product ? this.toResponseDTO(product) : null;
  }

  async listProducts(filters: ProductFilters, page: number, limit: number): Promise<PaginatedResult<ProductResponseDTO>> {
    const result = await this.productRepo.findAll(filters, page, limit);
    return {
      ...result,
      items: result.items.map(p => this.toResponseDTO(p))
    };
  }

  private toResponseDTO(product: Product): ProductResponseDTO {
    return {
      id: product.id,
      skuInternal: product.sku.getValue(),
      partNumberOEM: 'N/A',
      nameCommercial: product.name,
      brandId: product.brandId,
      categoryId: product.categoryId,
      locationBin: 'DEFAULT',
      costPriceAvg: product.costPrice.getValue(),
      salePriceBase: product.salePrice.getValue(),
      stockQuantity: product.stockQuantity,
      minStockLevel: product.minStockLevel,
      isActive: product.isActive,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt
    };
  }
}
