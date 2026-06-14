import { Request, Response } from 'express';
export async function uploadProductImage(_req: Request, res: Response) {
  return res.status(501).json({ success: false, error: 'Módulo de imágenes en mantenimiento' });
}
export async function deleteProductImage(_req: Request, res: Response) {
  return res.status(501).json({ success: false, error: 'Módulo de imágenes en mantenimiento' });
}
export async function getProductImage(_req: Request, res: Response) {
  return res.status(501).json({ success: false, error: 'Módulo de imágenes en mantenimiento' });
}
export const handleProductImageUpload = uploadProductImage;
