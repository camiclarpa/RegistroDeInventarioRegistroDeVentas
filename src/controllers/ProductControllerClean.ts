import { Request, Response } from 'express';
import { container } from '../infrastructure/config/di-container';
import { ProductService } from '../core/application/services/ProductService';

const productService = container.resolve(ProductService);

export const ProductController = {
  async createProduct(req: Request, res: Response): Promise<Response> {
    try {
      const product = await productService.createProduct(req.body);
      return res.status(201).json({ success: true, data: product.toJSON() });
    } catch (error) {
      return res.status(400).json({ success: false, error: (error as Error).message });
    }
  },

  async getProductById(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const product = await productService.getProductById(id);
      if (!product) {
        return res.status(404).json({ success: false, error: 'Product not found' });
      }
      return res.json({ success: true, data: product.toJSON() });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async listProducts(req: Request, res: Response): Promise<Response> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const filters = {
        brandId: req.query.brandId as string,
        categoryId: req.query.categoryId as string,
        isActive: req.query.isActive === 'true' ? true : req.query.isActive === 'false' ? false : undefined,
        search: req.query.search as string
      };

      const result = await productService.listProducts(filters, page, limit);
      return res.json({ success: true, ...result });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  },

  async updateStock(req: Request, res: Response): Promise<Response> {
    try {
      const id = req.params.id as string;
      const { quantity } = req.body;
      await productService.updateStock(id, quantity);
      return res.json({ success: true, message: 'Stock updated successfully' });
    } catch (error) {
      return res.status(400).json({ success: false, error: (error as Error).message });
    }
  },

  async getLowStock(req: Request, res: Response): Promise<Response> {
    try {
      const products = await productService.getLowStock();
      return res.json({ success: true, data: products.map(p => p.toJSON()) });
    } catch (error) {
      return res.status(500).json({ success: false, error: (error as Error).message });
    }
  }
};
