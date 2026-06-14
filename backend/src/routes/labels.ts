import { Router } from 'express';
import { 
  getProductsForLabels, 
  getProductForLabel, 
  generateBarcode 
} from '../controllers/labelsController';

const router = Router();

/**
 * ⚠️  SOLO LECTURA - NO hay POST/PUT/DELETE para productos
 */

// ✅ GET - Leer productos (solo lectura)
router.get('/products', getProductsForLabels);

// ✅ GET - Leer un producto (solo lectura)
router.get('/products/:id', getProductForLabel);

// ✅ POST - Generar barcode (no toca la DB de productos)
router.post('/generate-barcode', generateBarcode);

export default router;
