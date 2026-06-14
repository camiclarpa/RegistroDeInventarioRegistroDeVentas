import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

export async function createTicket(data: { customerId: string; subject: string; description: string; priority?: string; assignedTo?: string; }) {
  const ticket = await prisma.tickets.create({
    data: {
      customerId: data.customerId,
      subject: data.subject,
      description: data.description,
      priority: data.priority ?? 'MEDIUM',
      assignedTo: data.assignedTo,
      status: 'OPEN'
    } as any,
  });
  logger.info(`[ticketService] Ticket ${ticket.id} creado — cliente ${data.customerId}`);
  return ticket;
}

export async function listTickets(params: { customerId?: string; status?: string; priority?: string; page: number; limit: number; }) {
  const { customerId, status, priority, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: any = {
    ...(customerId && { customerId }),
    ...(status && { status }),
    ...(priority && { priority })
  };
  const [items, total] = await prisma.$transaction([
    prisma.tickets.findMany({
      where,
      skip,
      take: limit,
      orderBy: [{ priority: 'asc' }, { createdAt: 'desc' }],
      include: { customers: { select: { id: true, name: true, phone: true } } }
    }),
    prisma.tickets.count({ where }),
  ]);
  return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function updateTicket(id: string, data: { status?: string; priority?: string; assignedTo?: string; resolution?: string; }) {
  const updateData: any = {
    ...(data.status && { status: data.status }),
    ...(data.priority && { priority: data.priority }),
    ...(data.assignedTo !== undefined && { assignedTo: data.assignedTo })
    // Removed: ...(data.resolution && { resolution: data.resolution })
  };
  if (data.status === 'RESOLVED' || data.status === 'CLOSED') {
    updateData.resolvedAt = new Date();
  }
  return prisma.tickets.update({ where: { id }, data: updateData as any });
}

export async function getTicketById(id: string) {
  return prisma.tickets.findUnique({
    where: { id },
    include: { customers: { select: { id: true, name: true, phone: true, email: true } } }
  });
}

export async function getOpenTicketCount() {
  return prisma.tickets.count({ where: { status: { in: ['OPEN', 'IN_PROGRESS'] } } });
}

