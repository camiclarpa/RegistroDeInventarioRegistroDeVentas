import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

/**
 * ✅ SOLO LECTURA - Obtener productos para etiquetas
 * NO modifica la base de datos de productos
 */
export const getProductsForLabels = async (req: Request, res: Response) => {
  try {
    const products = await prisma.product.findMany({
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        salePrice: true,
        costPrice: true,
        stock: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
      orderBy: { name: 'asc' },
    });

    res.json({ success: true, data: products, total: products.length });
  } catch (error) {
    console.error('Error leyendo productos para etiquetas:', error);
    res.status(500).json({ success: false, error: 'Error leyendo productos' });
  }
};

/**
 * ✅ SOLO LECTURA - Obtener un producto específico
 */
export const getProductForLabel = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const product = await prisma.product.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        barcode: true,
        name: true,
        salePrice: true,
        costPrice: true,
        stock: true,
        category: { select: { id: true, name: true } },
        brand: { select: { id: true, name: true } },
      },
    });

    if (!product) {
      return res.status(404).json({ success: false, error: 'Producto no encontrado' });
    }

    res.json({ success: true, data: product });
  } catch (error) {
    console.error('Error leyendo producto:', error);
    res.status(500).json({ success: false, error: 'Error leyendo producto' });
  }
};

/**
 * ✅ NUEVO - Generar código de barras (imagen PNG)
 */
export const generateBarcode = async (req: Request, res: Response) => {
  try {
    const { type, text, width, height } = req.body;
    const bwipjs = require('bwip-js');

    // Configuración por defecto
    const config: any = {
      bcid: type || 'code128',
      text: text,
      scale: 3,
      height: height || 10,
      includetext: true,
      textxalign: 'center',
    };

    if (width) config.width = width;

    bwipjs.toBuffer(config, (err: any, png: Buffer) => {
      if (err) {
        res.status(500).json({ success: false, error: err.message });
      } else {
        res.set('Content-Type', 'image/png');
        res.send(png);
      }
    });
  } catch (error) {
    console.error('Error generando barcode:', error);
    res.status(500).json({ success: false, error: 'Error generando barcode' });
  }
};
