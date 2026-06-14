import { Prisma } from '@prisma/client';
import { prisma } from '../config/prisma';
import ExcelJS from 'exceljs';

function toFloat(value: unknown): number {
  return parseFloat(String(value ?? 0)) || 0;
}

export interface ExcelColumn { header: string; key: string; width?: number; numFmt?: string; }

export async function getDashboardStats(_startDate?: Date, _endDate?: Date) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const todayEnd = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

  const [salesToday, salesMonth, expensesMonth, lowStockCount, recentSales] = await Promise.all([
    prisma.sales.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: todayStart, lte: todayEnd } }, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.sales.aggregate({ where: { status: 'COMPLETED', createdAt: { gte: monthStart, lte: monthEnd } }, _sum: { totalAmount: true }, _count: { id: true } }),
    prisma.financial_transactions.aggregate({ where: { type: 'EXPENSE', timestamp: { gte: monthStart, lte: monthEnd } }, _sum: { amount: true } }).catch(() => ({ _sum: { amount: null } })),
    prisma.products.count({ where: { isActive: true, stockQuantity: { lte: 5 } } }),
    prisma.sales.findMany({
      where: { status: 'COMPLETED' },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, saleNumber: true, totalAmount: true, status: true, paymentMethod: true, createdAt: true, customers: { select: { id: true, name: true } } }
    }),
  ]);

  return {
    kpis: {
      salesToday: toFloat(salesToday._sum.totalAmount),
      salesMonthTotal: toFloat(salesMonth._sum.totalAmount),
      expensesMonth: toFloat(expensesMonth._sum.amount),
      lowStockCount: lowStockCount,
      pendingInvoices: 0
    },
    recentSales: recentSales.map(s => ({
      id: s.id,
      saleNumber: s.saleNumber,
      total: toFloat(s.totalAmount),
      status: s.status,
      paymentMethod: s.paymentMethod,
      createdAt: s.createdAt.toISOString(),
      customer: s.customers
    })),
    salesTrend: [],
    categorySales: [],
    lowStockProducts: []
  };
}

export async function getProfitabilityReport(startDate: Date, endDate: Date) {
  const sales = await prisma.sales.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
    select: { totalAmount: true, sale_items: { select: { quantity: true, products: { select: { costPriceAvg: true } } } } }
  });

  let totalRevenue = 0, totalCost = 0;
  for (const sale of sales) {
    totalRevenue += toFloat(sale.totalAmount);
    for (const item of sale.sale_items || []) {
      totalCost += toFloat(item.products?.costPriceAvg || 0) * item.quantity;
    }
  }

  const grossProfit = totalRevenue - totalCost;
  return {
    period: { startDate, endDate },
    summary: {
      totalRevenue: parseFloat(totalRevenue.toFixed(2)),
      totalCost: parseFloat(totalCost.toFixed(2)),
      grossProfit: parseFloat(grossProfit.toFixed(2)),
      profitMarginPercentage: totalRevenue > 0 ? parseFloat(((grossProfit / totalRevenue) * 100).toFixed(2)) : 0
    },
    byCategory: [],
    byBrand: [],
    byProduct: []
  };
}

export async function buildSalesExportData(startDate: Date, endDate: Date) {
  const sales = await prisma.sales.findMany({
    where: { status: 'COMPLETED', createdAt: { gte: startDate, lte: endDate } },
    select: { saleNumber: true, createdAt: true, totalAmount: true, taxAmount: true, discountAmount: true, paymentMethod: true, customers: { select: { name: true, identificationNumber: true } } },
    orderBy: { createdAt: 'desc' }
  });

  const columns: ExcelColumn[] = [
    { header: '# Venta', key: 'saleNumber', width: 18 },
    { header: 'Fecha', key: 'date', width: 22 },
    { header: 'Cliente', key: 'customerName', width: 30 },
    { header: 'Identificación', key: 'identification', width: 18 },
    { header: 'Descuento', key: 'discount', width: 14, numFmt: '#,##0.00' },
    { header: 'Impuesto', key: 'tax', width: 14, numFmt: '#,##0.00' },
    { header: 'Total', key: 'total', width: 16, numFmt: '#,##0.00' },
    { header: 'Método de Pago', key: 'paymentMethod', width: 16 }
  ];

  const rows = sales.map(s => ({
    saleNumber: s.saleNumber,
    date: s.createdAt.toLocaleString('es-CO'),
    customerName: s.customers?.name || 'Consumidor Final',
    identification: s.customers?.identificationNumber || '',
    discount: toFloat(s.discountAmount),
    tax: toFloat(s.taxAmount),
    total: toFloat(s.totalAmount),
    paymentMethod: s.paymentMethod
  }));

  return { rows, columns, title: `Reporte de Ventas — ${startDate.toLocaleDateString('es-CO')} al ${endDate.toLocaleDateString('es-CO')}` };
}

export async function buildInventoryExportData() {
  const products = await prisma.products.findMany({
    where: { isActive: true },
    select: { skuInternal: true, nameCommercial: true, partNumberOEM: true, stockQuantity: true, minStockLevel: true, costPriceAvg: true, salePriceBase: true, taxRate: true, categories: { select: { name: true } }, brands: { select: { name: true } } },
    orderBy: { nameCommercial: 'asc' }
  });

  const columns: ExcelColumn[] = [
    { header: 'SKU', key: 'sku', width: 16 },
    { header: 'Nombre', key: 'name', width: 36 },
    { header: 'N° OEM', key: 'partNumberOEM', width: 18 },
    { header: 'Categoría', key: 'category', width: 22 },
    { header: 'Marca', key: 'brand', width: 18 },
    { header: 'Stock Actual', key: 'stock', width: 12 },
    { header: 'Stock Mínimo', key: 'minStock', width: 12 },
    { header: 'Costo Promedio', key: 'costAvg', width: 16, numFmt: '#,##0.0000' },
    { header: 'Precio Venta', key: 'salePrice', width: 16, numFmt: '#,##0.00' },
    { header: 'IVA %', key: 'taxRate', width: 8, numFmt: '0.00' },
    { header: 'Valor a Costo', key: 'costValue', width: 16, numFmt: '#,##0.00' },
    { header: 'Valor a Precio', key: 'saleValue', width: 16, numFmt: '#,##0.00' },
    { header: 'Estado Stock', key: 'stockStatus', width: 14 }
  ];

  const rows = products.map(p => {
    const costAvg = toFloat(p.costPriceAvg);
    const salePrice = toFloat(p.salePriceBase);
    const stock = p.stockQuantity;
    const minStock = p.minStockLevel || 5;
    return {
      sku: p.skuInternal,
      name: p.nameCommercial,
      partNumberOEM: p.partNumberOEM,
      category: p.categories?.name || 'Sin Categoría',
      brand: p.brands?.name || 'Sin Marca',
      stock: stock,
      minStock: minStock,
      costAvg: parseFloat(costAvg.toFixed(4)),
      salePrice: parseFloat(salePrice.toFixed(2)),
      taxRate: toFloat(p.taxRate),
      costValue: parseFloat((costAvg * stock).toFixed(2)),
      saleValue: parseFloat((salePrice * stock).toFixed(2)),
      stockStatus: stock === 0 ? 'SIN STOCK' : stock <= minStock ? 'BAJO' : 'OK'
    };
  });

  return { rows, columns, title: `Inventario — ${new Date().toLocaleDateString('es-CO')}` };
}

export async function generateExcelBuffer(rows: Record<string, unknown>[], columns: ExcelColumn[], sheetName = 'Reporte', reportTitle?: string): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'SIGC-Motos';
  const sheet = workbook.addWorksheet(sheetName);
  let dataStartRow = 1;

  if (reportTitle) {
    sheet.addRow([reportTitle]);
    const titleRow = sheet.getRow(1);
    titleRow.font = { bold: true, size: 14 };
    sheet.mergeCells(1, 1, 1, columns.length);
    sheet.addRow([]);
    dataStartRow = 3;
  }

  sheet.columns = columns.map(col => ({ header: col.header, key: col.key, width: col.width ?? 18 }));
  rows.forEach(row => sheet.addRow(row));
  columns.forEach(col => { if (col.numFmt) sheet.getColumn(col.key).numFmt = col.numFmt; });

  return workbook.xlsx.writeBuffer() as unknown as Promise<Buffer>;
}

// Funciones placeholder para compatibilidad
export async function getInventoryValuation() {
  return { summary: { costValue: 0, potentialSaleValue: 0, potentialMargin: 0, marginPercentage: 0, totalUnitsInStock: 0, activeProductsWithStock: 0 }, topByValue: [], byCategory: [] };
}

export async function getLowStockProducts() {
  return [];
}

export async function getProductRotationABC(startDate: Date, endDate: Date) {
  return { summary: { totalProducts: 0, totalUnitsSold: 0, classA: 0, classB: 0, classC: 0, period: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] } }, products: [] };
}

export async function buildProductsRotationExportData(startDate: Date, endDate: Date) {
  return { rows: [], columns: [], title: 'Rotación ABC' };
}

export async function getInventoryAgingReport() {
  return { summary: { totalProducts: 0, stagnantProducts: 0, totalInventoryValue: 0, stagnantThresholdDays: 90 }, products: [] };
}

export async function getSalesByCategoryOrBrand(groupBy: 'CATEGORY' | 'BRAND', startDate: Date, endDate: Date) {
  return [];
}

export async function getCustomerTopBuyers(limit: number) {
  return [];
}

export async function getSupplierPerformanceReport() {
  return [];
}

export async function getExecutiveDashboard(startDate: Date, endDate: Date) {
  return {
    period: { startDate: startDate.toISOString().split('T')[0], endDate: endDate.toISOString().split('T')[0] },
    kpis: { totalGrossSales: 0, transactionCount: 0, averageTicket: 0, topSellingProduct: null },
    dailySalesChart: [],
    topProducts: []
  };
}

