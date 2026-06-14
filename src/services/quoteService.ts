import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export interface QuoteItem { productId?: string; description: string; qty: number; unitPrice: number; discount?: number; }

function calcTotals(items: QuoteItem[], globalDiscount = 0) {
  const subtotal = items.reduce((s, i) => { 
    const lineDiscount = i.discount ?? 0; 
    return s + i.qty * i.unitPrice * (1 - lineDiscount / 100); 
  }, 0);
  const total = subtotal * (1 - globalDiscount / 100);
  return { subtotal, total };
}

export async function createQuote(data: { customerId: string; items: QuoteItem[]; discount?: number; expiresAt?: Date; createdById: string; }) {
  const { subtotal, total } = calcTotals(data.items, data.discount);
  const quote = await prisma.quotes.create({
    data: {
      customer_id: data.customerId,
      items: data.items as any,
      subtotal,
      discount: data.discount ?? 0,
      total,
      status: 'DRAFT',
      expires_at: data.expiresAt,
      created_by_id: data.createdById
    } as any,
  });
  logger.info(`[quoteService] Cotización ${quote.id} creada — $${total}`);
  return quote;
}

export async function getQuoteById(id: string) {
  const quote = await prisma.quotes.findUnique({
    where: { id },
    include: {
      customers: { select: { id: true, name: true, phone: true, email: true } },
      quote_deliveries: { orderBy: { created_at: 'desc' } }
    }
  });
  return quote;
}

export async function listQuotes(params: { customerId?: string; status?: string; page: number; limit: number; }) {
  const { customerId, status, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: any = {
    ...(customerId && { customer_id: customerId }),
    ...(status && { status })
  };
  const [items, total] = await prisma.$transaction([
    prisma.quotes.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { customers: { select: { id: true, name: true, phone: true } } }
    }),
    prisma.quotes.count({ where }),
  ]);
  return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function updateQuoteStatus(id: string, status: string) {
  return prisma.quotes.update({ where: { id }, data: { status } as any });
}

export async function recordDelivery(data: { quoteId: string; channel: string; link?: string; attemptedBy: string; }) {
  const delivery = await prisma.quote_deliveries.create({
    data: {
      quote_id: data.quoteId,
      channel: data.channel,
      status: 'SENT',
      link: data.link,
      sent_at: new Date(),
      attempted_by: data.attemptedBy
    } as any,
  });
  await prisma.quotes.update({ where: { id: data.quoteId }, data: { status: 'SENT' } as any });
  return delivery;
}

export async function buildWhatsAppLink(quoteId: string, phone: string) {
  const quote = await getQuoteById(quoteId);
  if (!quote) throw new Error('Cotización no encontrada');
  const customer = quote.customers;
  const text = encodeURIComponent(`Hola ${customer?.name || 'Cliente'}, le compartimos su cotización #${quoteId.slice(-6).toUpperCase()} por $${Number(quote.total).toLocaleString('es-CO')}. Válida hasta ${quote.expires_at ? new Date(quote.expires_at).toLocaleDateString('es-CO') : 'sin vencimiento'}.`);
  return `https://wa.me/${phone.replace(/\D/g, '')}?text=${text}`;
}

