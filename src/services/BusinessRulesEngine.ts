export interface RuleResult { warnings: string[]; errors: string[]; }

const IVA_EXEMPT_CATEGORIES = new Set(['MEDICAMENTOS', 'LIBROS', 'PRODUCTOS BASICOS']);
const MIN_PRICE_BY_CATEGORY: Record<string, number> = { 'ACEITES': 10000, 'FILTROS': 5000, 'FRENOS': 8000 };

export class BusinessRulesEngine {
  validatePriceForCategory(category: string, salePrice: number, costPrice: number): RuleResult {
    const warnings: string[] = []; const errors: string[] = [];
    const cat = category.toUpperCase();
    if (salePrice > 0 && costPrice > 0 && salePrice < costPrice) {
      errors.push(`Precio venta ($${salePrice}) < costo ($${costPrice})`);
    }
    for (const [key, minPrice] of Object.entries(MIN_PRICE_BY_CATEGORY)) {
      if (cat.includes(key) && salePrice > 0 && salePrice < minPrice) {
        warnings.push(`Precio bajo para ${key} (mín: $${minPrice})`);
      }
    }
    return { warnings, errors };
  }

  calculateIVA(costPrice: number, salePrice: number, category: string): number {
    const cat = category.toUpperCase().replace(/[^A-Z ]/g, '').trim();
    if (IVA_EXEMPT_CATEGORIES.has(cat)) return 0;
    if (costPrice > 0 && salePrice > costPrice) {
      const calc = ((salePrice / costPrice) - 1) * 100;
      if (calc >= 5 && calc <= 30) return Math.round(calc);
    }
    return 19;
  }

  runAll(product: any): RuleResult {
    const warnings: string[] = []; const errors: string[] = [];
    if (!product.name || product.name.trim().length < 2) errors.push('Nombre inválido');
    if (!product.salePrice || product.salePrice <= 0) errors.push('Precio venta requerido');
    if (product.category && product.salePrice) {
      const r = this.validatePriceForCategory(product.category, product.salePrice, product.costPrice ?? 0);
      warnings.push(...r.warnings); errors.push(...r.errors);
    }
    return { warnings, errors };
  }
}
