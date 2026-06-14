import { Request, Response } from 'express';
import { labelPrinter, LabelData } from '../services/labelPrinterService';
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';
import { logAction } from '../services/auditService';

export async function printLabel(req: Request, res: Response) {
  try {
    const productId = req.params.id as string;
    const method = (req.body.method as string) || 'auto';

    const product = await prisma.products.findUnique({
      where: { id: productId },
      include: { brands: { select: { name: true } } },
    });

    if (!product) return res.status(404).json({ success: false, error: 'Producto no encontrado' });

    const labelData: LabelData = {
      productName: product.nameCommercial,
      price: Number(product.salePriceBase),
      sku: product.skuInternal,
      barcode: product.barcodeExternal || product.skuInternal,
      brandName: product.brands?.name,
    };

    if (labelData.barcode.length !== 13 || !/^\d+$/.test(labelData.barcode)) {
      logger.warn('[Label] Barcode no es EAN13 válido', { barcode: labelData.barcode });
    }

    const result = await labelPrinter.printLabel(labelData);
    if (result.success) {
      await logAction(req.user?.id || null, 'LABEL_PRINTED', 'Product', productId, { labelData, method }, req.ip);
      logger.info('[Label] Etiqueta impresa', { productId, correlation_id: (req as any).correlationId });
      return res.json({ success: true, message: 'Etiqueta enviada a impresora' });
    }
    return res.status(500).json({ success: false, error: result.error });
  } catch (error) {
    logger.error('[Label] Error al imprimir', { error, correlation_id: (req as any).correlationId });
    return res.status(500).json({ success: false, error: 'Error al imprimir etiqueta' });
  }
}

export async function downloadLabel(req: Request, res: Response) {
  try {
    const productId = req.params.id as string;
    const product = await prisma.products.findUnique({
      where: { id: productId },
      select: { nameCommercial: true, salePriceBase: true, skuInternal: true, barcodeExternal: true }
    });
    if (!product) return res.status(404).json({ success: false, error: 'Producto no encontrado' });

    const result = await labelPrinter.downloadPDF({
      productName: product.nameCommercial,
      price: Number(product.salePriceBase),
      sku: product.skuInternal,
      barcode: product.barcodeExternal || product.skuInternal,
    });

    if (result.success && result.pdf) {
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="etiqueta_${product.skuInternal}.pdf"`);
      return res.send(result.pdf);
    }
    return res.status(500).json({ success: false, error: result.error });
  } catch (error) {
    logger.error('[Label] Error al generar PDF', { error });
    return res.status(500).json({ success: false, error: 'Error al generar PDF' });
  }
}

export async function testPrinter(req: Request, res: Response) {
  try {
    const result = await labelPrinter.printLabel({
      productName: 'PRUEBA', price: 0, sku: 'TEST', barcode: '1234567890123'
    });
    return result.success 
      ? res.json({ success: true, message: 'Impresora funcionando' })
      : res.status(500).json({ success: false, error: result.error });
  } catch (error) {
    logger.error('[Label] Error en test', { error });
    return res.status(500).json({ success: false, error: 'Error en test' });
  }
}
