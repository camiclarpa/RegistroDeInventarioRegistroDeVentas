/**
 * Utilidades de sanitización para entrada de usuario en backend
 * Previenen errores de validación Zod 422 y aseguran consistencia de datos
 */

/**
 * Sanitiza SKU para cumplir con regex: /^[A-Z0-9-]+$/
 * Transforma: "piñón-gn-125" → "PINON-GN-125"
 */
export function sanitizeSKU(sku: string): string {
  if (!sku) return '';
  
  return sku
    .toUpperCase()
    .normalize('NFD')                              // Descomponer caracteres Unicode
    .replace(/[\u0300-\u036f]/g, '')              // Remover diacríticos (tildes)
    .replace(/ñ/g, 'N')                            // Ñ → N (por si acaso)
    .replace(/[^A-Z0-9-]/g, '-')                  // Reemplazar cualquier otro caracter con guión
    .replace(/-+/g, '-')                          // Colapsar múltiples guiones seguidos
    .replace(/^-|-$/g, '')                        // Remover guiones al inicio/fin
    .substring(0, 20);                             // Limitar a 20 caracteres (schema max)
}

/**
 * Sanitiza texto comercial (nombre, descripción, etc.)
 * - Trim de espacios extremos
 * - Colapsa espacios múltiples internos
 * - Limita longitud máxima
 */
export function sanitizeText(text: string, maxLength: number): string {
  if (!text) return '';
  
  return text
    .trim()
    .replace(/\s+/g, ' ')                          // Colapsar espacios múltiples
    .substring(0, maxLength);                       // Limitar longitud
}

/**
 * Sanitiza ubicación de bodega (locationBin)
 * - Formato alfanumérico con guiones
 * - Sin caracteres especiales peligrosos
 * - Default seguro si está vacío
 */
export function sanitizeLocationBin(location: string): string {
  if (!location || !location.trim()) return 'SIN-UBICACION';
  
  return location
    .toUpperCase()
    .trim()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')              // Remover tildes
    .replace(/[^A-Z0-9-\s]/g, '')                 // Solo alfanumérico, espacios y guiones
    .replace(/\s+/g, '-')                          // Espacios → guiones
    .replace(/-+/g, '-')                          // Colapsar guiones
    .substring(0, 50) || 'SIN-UBICACION';          // Limitar y fallback
}

/**
 * Sanitiza número de parte OEM
 * - Preserva formato pero remueve caracteres de control
 * - Limita longitud máxima
 */
export function sanitizePartNumber(part: string): string {
  if (!part) return '';
  
  return part
    .trim()
    .replace(/[\x00-\x1F\x7F]/g, '')              // Remover caracteres de control ASCII
    .substring(0, 100);                             // Limitar a 100 caracteres (schema max)
}

/**
 * Sanitiza barcode externo
 * - Solo dígitos y guiones (formato EAN/UPC típico)
 * - Limita longitud
 */
export function sanitizeBarcode(barcode: string): string {
  if (!barcode) return '';
  
  return barcode
    .trim()
    .replace(/[^0-9-]/g, '')                       // Solo dígitos y guiones
    .substring(0, 50);                              // Limitar a 50 caracteres (schema max)
}

/**
 * Objeto de sanitización para producto completo
 * Aplica todas las sanitizaciones apropiadas por campo
 * Mantiene campos no string sin modificar
 */
export function sanitizeProductInput(input: Record<string, unknown>): Record<string, unknown> {
  const sanitized: Record<string, unknown> = { ...input };
  
  // SKU: sanitización estricta
  if (input.skuInternal && typeof input.skuInternal === 'string') {
    sanitized.skuInternal = sanitizeSKU(input.skuInternal);
  }
  
  // Textos comerciales
  if (input.nameCommercial && typeof input.nameCommercial === 'string') {
    sanitized.nameCommercial = sanitizeText(input.nameCommercial, 200);
  }
  
  if (input.partNumberOEM && typeof input.partNumberOEM === 'string') {
    sanitized.partNumberOEM = sanitizePartNumber(input.partNumberOEM);
  }
  
  if (input.descriptionTech && typeof input.descriptionTech === 'string') {
    sanitized.descriptionTech = sanitizeText(input.descriptionTech, 2000);
  }
  
  // Ubicación
  if (input.locationBin !== undefined) {
    sanitized.locationBin = typeof input.locationBin === 'string' 
      ? sanitizeLocationBin(input.locationBin)
      : 'SIN-UBICACION';
  }
  
  // Barcode
  if (input.barcodeExternal && typeof input.barcodeExternal === 'string') {
    sanitized.barcodeExternal = sanitizeBarcode(input.barcodeExternal);
  }
  
  // Campos numéricos: asegurar tipo y valores válidos
  if (input.costPriceAvg !== undefined) {
    const val = Number(input.costPriceAvg);
    sanitized.costPriceAvg = isNaN(val) ? 0 : Math.max(0, val);
  }
  
  if (input.salePriceBase !== undefined) {
    const val = Number(input.salePriceBase);
    sanitized.salePriceBase = isNaN(val) ? 0 : Math.max(0, val);
  }
  
  if (input.taxRate !== undefined) {
    const val = Number(input.taxRate);
    sanitized.taxRate = isNaN(val) ? 19 : Math.max(0, Math.min(100, val));
  }
  
  if (input.stockQuantity !== undefined) {
    const val = Math.floor(Number(input.stockQuantity));
    sanitized.stockQuantity = isNaN(val) ? 0 : Math.max(0, val);
  }
  
  if (input.minStockLevel !== undefined) {
    const val = Math.floor(Number(input.minStockLevel));
    sanitized.minStockLevel = isNaN(val) ? 5 : Math.max(0, val);
  }
  
  if (input.maxStockLevel !== undefined && input.maxStockLevel !== null) {
    const val = Math.floor(Number(input.maxStockLevel));
    sanitized.maxStockLevel = isNaN(val) ? undefined : Math.max(0, val);
  }
  
  // Booleanos: convertir string 'true'/'false' a boolean real
  if (input.isActive !== undefined) {
    sanitized.isActive = input.isActive === true || input.isActive === 'true';
  }
  
  return sanitized;
}
