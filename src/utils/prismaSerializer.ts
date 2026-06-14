/**
 * Serializa objetos de Prisma para respuestas JSON
 * Convierte enums y Decimals a tipos nativos de JavaScript
 */

export function serializeSale(sale: any) {
  if (!sale) return null;
  
  return {
    ...sale,
    // Convertir enum SaleStatus a string
    status: sale.status ? String(sale.status) : 'COMPLETED',
    // Convertir Decimals a números
    totalAmount: sale.totalAmount ? Number(sale.totalAmount) : 0,
    subtotal: sale.subtotal ? Number(sale.subtotal) : 0,
    discountAmount: sale.discountAmount ? Number(sale.discountAmount) : 0,
    taxAmount: sale.taxAmount ? Number(sale.taxAmount) : 0,
    // Serializar items si existen
    items: sale.items?.map((item: any) => ({
      ...item,
      lineTotal: item.lineTotal ? Number(item.lineTotal) : 0,
      quantity: item.quantity ? Number(item.quantity) : 0,
    })) ?? [],
  };
}

export function serializeSales(sales: any[]) {
  return sales.map(serializeSale);
}
