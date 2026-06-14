/**
 * taxService.ts — Pilar 4: Retenciones e Impuestos
 */
import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

const WITHHOLDING_RATES: Record<string, number> = {
  'RETEFUENTE_35': 0.035,
  'RETEFUENTE_10': 0.10,
  'RETEIVA_15': 0.15,
  'RETEICA_01': 0.001,
};

const WITHHOLDING_LABELS: Record<string, string> = {
  'RETEFUENTE_35': 'Retefuente 3.5%',
  'RETEFUENTE_10': 'Retefuente 10%',
  'RETEIVA_15': 'ReteIVA 15%',
  'RETEICA_01': 'ReteICA ~0.1%',
};

const STANDARD_IVA_RATE = 0.19;

function toNum(v: unknown): number { return parseFloat(String(v ?? 0)) || 0; }
function startOfMonth(month: number, year: number): Date { return new Date(year, month - 1, 1, 0, 0, 0, 0); }
function endOfMonth(month: number, year: number): Date { return new Date(year, month, 0, 23, 59, 59, 999); }

export interface WithholdingCalculation {
  type: string;
  label: string;
  percentage: number;
  baseAmount: number;
  withholdingAmount: number;
  netAmount: number;
}

export function calculateWithholding(baseAmount: number, type: string): WithholdingCalculation {
  const rate = WITHHOLDING_RATES[type] || 0;
  const withholding = parseFloat((baseAmount * rate).toFixed(2));
  const net = parseFloat((baseAmount - withholding).toFixed(2));
  return { 
    type, 
    label: WITHHOLDING_LABELS[type] || type, 
    percentage: parseFloat((rate * 100).toFixed(2)), 
    baseAmount: parseFloat(baseAmount.toFixed(2)), 
    withholdingAmount: withholding, 
    netAmount: net 
  };
}

export async function registerWithholding(transactionId: string, type: string, baseAmount: number): Promise<object> {
  const calc = calculateWithholding(baseAmount, type);
  const withholding = await prisma.tax_withholdings.create({
    data: { 
      transactionId, 
      type, 
      percentage: calc.percentage, 
      baseAmount: calc.baseAmount, 
      withholdingAmount: calc.withholdingAmount, 
      netAmount: calc.netAmount 
    } as any,
  });
  logger.info(`[taxService] Retención ${WITHHOLDING_LABELS[type] || type}: base=$${baseAmount.toFixed(2)}, retenido=$${calc.withholdingAmount.toFixed(2)}`);
  return withholding;
}

export interface MonthlyTaxSummary {
  period: { month: number; year: number; label: string };
  ivaCollected: number;
  ivaDeductible: number;
  ivaNetPayable: number;
  withholdings: { type: string; label: string; totalWithheld: number; count: number; }[];
  totalWithheldAsAsset: number;
  reteiva: number;
  reteica: number;
  netObligations: number;
}

export async function getMonthlyTaxSummary(month: number, year: number): Promise<MonthlyTaxSummary> {
  const monthStart = startOfMonth(month, year);
  const monthEnd = endOfMonth(month, year);
  const MONTH_NAMES = ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  const salesWithIva = await prisma.sales.aggregate({
    where: { status: 'COMPLETED', createdAt: { gte: monthStart, lte: monthEnd } },
    _sum: { taxAmount: true, total: true },
  });
  const ivaCollected = toNum(salesWithIva._sum.taxAmount);

  const withholdingsRaw = await prisma.tax_withholdings.findMany({
    where: { createdAt: { gte: monthStart, lte: monthEnd } },
  });

  const withholdingMap = new Map<string, { total: number; count: number }>();
  for (const w of withholdingsRaw) {
    const existing = withholdingMap.get(w.type) ?? { total: 0, count: 0 };
    existing.total += toNum(w.withholdingAmount);
    existing.count += 1;
    withholdingMap.set(w.type, existing);
  }

  const withholdings = Array.from(withholdingMap.entries()).map(([type, data]) => ({
    type, 
    label: WITHHOLDING_LABELS[type] || type, 
    totalWithheld: parseFloat(data.total.toFixed(2)), 
    count: data.count,
  }));

  const totalWithheldAsAsset = withholdings.reduce((s, w) => s + w.totalWithheld, 0);
  const reteiva = withholdingMap.get('RETEIVA_15')?.total ?? 0;
  const reteica = withholdingMap.get('RETEICA_01')?.total ?? 0;

  const expenseAgg = await prisma.financial_transactions.aggregate({
    where: { type: 'EXPENSE', timestamp: { gte: monthStart, lte: monthEnd } },
    _sum: { amount: true },
  });
  const ivaDeductible = parseFloat((toNum(expenseAgg._sum.amount) * STANDARD_IVA_RATE).toFixed(2));
  const ivaNetPayable = parseFloat(Math.max(0, ivaCollected - ivaDeductible).toFixed(2));
  const netObligations = parseFloat((ivaNetPayable - totalWithheldAsAsset).toFixed(2));

  logger.info(`[taxService] ResumenFiscal ${MONTH_NAMES[month]}/${year}: IVA cobrado=$${ivaCollected.toFixed(2)}, deducible=$${ivaDeductible.toFixed(2)}`);

  return {
    period: { month, year, label: `${MONTH_NAMES[month]} ${year}` },
    ivaCollected: parseFloat(ivaCollected.toFixed(2)),
    ivaDeductible: parseFloat(ivaDeductible.toFixed(2)),
    ivaNetPayable,
    withholdings,
    totalWithheldAsAsset: parseFloat(totalWithheldAsAsset.toFixed(2)),
    reteiva: parseFloat(reteiva.toFixed(2)),
    reteica: parseFloat(reteica.toFixed(2)),
    netObligations,
  };
}

