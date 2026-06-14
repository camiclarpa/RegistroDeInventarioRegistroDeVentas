import { Sale, CreateSaleParams } from '../../domain/entities/Sale';
import { ISaleRepository } from '../../domain/repositories/ISaleRepository';
import { IProductRepository } from '../../domain/repositories/IProductRepository';

export class SaleService {
  constructor(
    private readonly saleRepo: ISaleRepository,
    private readonly productRepo: IProductRepository
  ) {}

  async createSale(params: CreateSaleParams): Promise<Sale> {
    // Validar stock de productos
    for (const item of params.items) {
      const product = await this.productRepo.findById(item.productId);
      if (!product) {
        throw new Error(`Product ${item.productId} not found`);
      }
      if (!product.canBeSold(item.quantity)) {
        throw new Error(`Insufficient stock for product ${product.name}`);
      }
    }

    const sale = Sale.create(params);
    await this.saleRepo.save(sale);

    // Actualizar stock
    for (const item of params.items) {
      await this.productRepo.updateStock(item.productId, -item.quantity);
    }

    return sale;
  }

  async getSaleById(id: string): Promise<Sale | null> {
    return this.saleRepo.findById(id);
  }

  async getSaleByNumber(saleNumber: string): Promise<Sale | null> {
    return this.saleRepo.findByNumber(saleNumber);
  }

  async listSales(page: number, limit: number, filters?: any): Promise<{
    items: Sale[];
    total: number;
    page: number;
    limit: number;
  }> {
    const { items, total } = await this.saleRepo.findAll(page, limit, filters);
    return { items, total, page, limit };
  }

  async cancelSale(id: string): Promise<Sale> {
    const sale = await this.saleRepo.findById(id);
    if (!sale) {
      throw new Error(`Sale ${id} not found`);
    }
    const cancelledSale = sale.cancel();
    await this.saleRepo.updateStatus(id, 'CANCELLED');
    return cancelledSale;
  }

  async getCustomerSales(customerId: string): Promise<Sale[]> {
    return this.saleRepo.getSalesByCustomer(customerId);
  }
}
