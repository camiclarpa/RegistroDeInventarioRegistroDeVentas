import { prisma } from '../config/prisma';

function toFloat(v: unknown): number {
  return parseFloat(String(v ?? 0)) || 0;
}

function classifyRfm(recency: number, frequency: number, monetary: number): string {
  if (recency <= 30 && frequency >= 6 && monetary >= 500_000) return 'VIP';
  if (recency <= 60 && frequency >= 4 && monetary >= 200_000) return 'LOYAL';
  if (recency <= 90 && frequency >= 2) return 'REGULAR';
  if (recency <= 90 && frequency >= 1) return 'NEW';
  if (recency <= 180 && frequency >= 2) return 'AT_RISK';
  if (recency <= 365 && frequency >= 1) return 'DORMANT';
  return 'CHURNED';
}

function calcCreditRisk(pendingDebt: number, creditLimit: number | null, daysOverdue: number, frequency: number): number {
  let score = 50;
  if (daysOverdue > 90) score -= 40;
  else if (daysOverdue > 45) score -= 20;
  else if (daysOverdue > 15) score -= 10;
  if (creditLimit && pendingDebt / creditLimit > 0.9) score -= 10;
  if (frequency >= 5) score += 10;
  if (frequency >= 10) score += 10;
  return Math.max(0, Math.min(100, score));
}

function getAgingBucket(daysOverdue: number): string {
  if (daysOverdue <= 0) return 'CURRENT';
  if (daysOverdue <= 30) return '1_30';
  if (daysOverdue <= 60) return '31_60';
  if (daysOverdue <= 90) return '61_90';
  return '90_PLUS';
}

export async function refreshCustomerRfm(customerId: string) {
  const now = new Date();
  const sixMonthsAgo = new Date(now.getTime() - 180 * 86_400_000);
  
  const [customer, salesLast6m, openDebt] = await Promise.all([
    prisma.customers.findUnique({ 
      where: { id: customerId }, 
      select: { lastPurchaseAt: true, creditLimit: true } 
    }),
    prisma.sales.aggregate({ 
      where: { customerId, status: 'COMPLETED', createdAt: { gte: sixMonthsAgo } }, 
      _count: { id: true }, 
      _sum: { totalAmount: true } 
    }),
    prisma.accounts_receivable.aggregate({ 
      where: { customerId, status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } }, 
      _sum: { remainingBalance: true }, 
      _max: { days_overdue: true } 
    }),
  ]);
  
  if (!customer) return;
  
  const recencyDays = customer.lastPurchaseAt 
    ? Math.floor((now.getTime() - customer.lastPurchaseAt.getTime()) / 86_400_000) 
    : 9999;
  const frequency6m = salesLast6m._count.id;
  const monetary6m = toFloat(salesLast6m._sum.totalAmount);
  const rfmSegment = classifyRfm(recencyDays, frequency6m, monetary6m);
  const pendingDebt = toFloat(openDebt._sum.remainingBalance);
  const maxOverdue = openDebt._max.days_overdue ?? 0;
  const creditRiskScore = calcCreditRisk(pendingDebt, customer.creditLimit ? toFloat(customer.creditLimit) : null, maxOverdue, frequency6m);
  
  await prisma.customers.update({ 
    where: { id: customerId }, 
    data: { recencyDays, frequency6m, monetary6m, rfmSegment, creditRiskScore } 
  });
  
  return { recencyDays, frequency6m, monetary6m, rfmSegment, creditRiskScore };
}

export async function refreshAllRfm() {
  const customers = await prisma.customers.findMany({ 
    where: { isActive: true }, 
    select: { id: true } 
  });
  let updated = 0;
  for (const c of customers) {
    await refreshCustomerRfm(c.id);
    updated++;
  }
  return updated;
}

export async function refreshAgingBuckets() {
  const now = new Date();
  const pending = await prisma.accounts_receivable.findMany({ 
    where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } }, 
    select: { id: true, dueDate: true } 
  });
  
  let updated = 0;
  for (const ar of pending) {
    const daysOverdue = ar.dueDate 
      ? Math.max(0, Math.floor((now.getTime() - ar.dueDate.getTime()) / 86_400_000)) 
      : 0;
    const agingBucket = getAgingBucket(daysOverdue);
    await prisma.accounts_receivable.update({ 
      where: { id: ar.id }, 
      data: { days_overdue: daysOverdue, aging_bucket: agingBucket } 
    });
    updated++;
  }
  return updated;
}

export async function getCrmKpis() {
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86_400_000);
  
  const [totalCustomers, activeCustomers, segmentDistribution, agingDistribution, recentCommunications, openTickets] = await Promise.all([
    prisma.customers.count({ where: { isActive: true } }),
    prisma.customers.count({ where: { isActive: true, lastPurchaseAt: { gte: thirtyDaysAgo } } }),
// @ts-ignore - Error de referencia circular falso positivo de TypeScript
    prisma.customers.groupBy({ 
      by: ['rfmSegment'], 
      where: { isActive: true }, 
      _count: { id: true } 
    }),
    prisma.accounts_receivable.groupBy({ 
      by: ['aging_bucket'], 
      where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } }, 
      _count: { id: true }, 
      _sum: { remainingBalance: true } 
    }),
    prisma.communications.count({ where: { created_at: { gte: thirtyDaysAgo } } }),
    prisma.tickets.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
  ]);
  
  const retentionRate = totalCustomers > 0 ? Math.round((activeCustomers / totalCustomers) * 100) : 0;
  
  return {
    totalCustomers,
    activeCustomers,
    retentionRate,
    recentCommunications,
    openTickets,
    segmentDistribution: segmentDistribution.map(s => ({ segment: s.rfmSegment, count: s._count.id })),
    agingDistribution: agingDistribution.map(a => ({ 
      bucket: a.aging_bucket, 
      count: a._count.id, 
      amount: toFloat(a._sum.remainingBalance) 
    })),
  };
}

export async function triggerDunningAlerts() {
  const cutoff = new Date(Date.now() - 45 * 86_400_000);
  const overdue = await prisma.accounts_receivable.findMany({ 
    where: { status: { in: ['PENDING', 'PARTIALLY_PAID'] }, dueDate: { lt: cutoff } }, 
    include: { customers: { select: { id: true, name: true } } } 
  });
  
  for (const ar of overdue) {
    const daysLate = Math.floor((Date.now() - (ar.dueDate?.getTime() ?? 0)) / 86_400_000);
    await prisma.reminders.upsert({ 
      where: { id: `dunning-${ar.id}` }, 
      update: {}, 
      create: { 
        id: `dunning-${ar.id}`, 
        customerId: ar.customerId, 
        type: 'PAYMENT_DUE', 
        message: `Cliente ${ar.customers?.name} tiene ${daysLate} días de mora. Saldo: $${toFloat(ar.remainingBalance).toLocaleString('es-CO')}`, 
        dueDate: new Date() 
      } as any 
    });
    await prisma.accounts_receivable.update({ 
      where: { id: ar.id }, 
      data: { status: 'OVERDUE' } 
    });
  }
  return overdue.length;
}

