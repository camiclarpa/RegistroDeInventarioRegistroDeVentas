import { prisma } from '../config/prisma';
import { logger } from '../config/logger';

const OIL_CHANGE_KM = 3000;
const OIL_CHANGE_DAYS = 90;

export async function createWorkshopVisit(data: { 
  customerId: string; 
  motorcycleId?: string; 
  kmReal?: number; 
  services: string[]; 
  technician?: string; 
  totalCost: number; 
  notes?: string; 
  nextServiceKm?: number; 
  nextServiceDate?: Date; 
}) {
  const nextKm = data.nextServiceKm ?? (data.kmReal ? data.kmReal + OIL_CHANGE_KM : undefined);
  const visit = await prisma.workshop_visits.create({
    data: {
      customer_id: data.customerId,
      motorcycle_id: data.motorcycleId,
      km_real: data.kmReal,
      services: data.services,
      technician: data.technician,
      total_cost: data.totalCost,
      status: 'COMPLETED',
      notes: data.notes,
      next_service_km: nextKm,
      next_service_date: data.nextServiceDate
    } as any,
  });
  
  if (data.motorcycleId && data.kmReal) {
    await prisma.motorcycles.update({ 
      where: { id: data.motorcycleId }, 
      data: { last_km: data.kmReal } as any 
    });
  }
  
  await schedulePredictiveReminders(visit.id, data.customerId, data.motorcycleId, data.kmReal, data.services);
  logger.info(`[workshopService] Visita ${visit.id} registrada — cliente ${data.customerId}`);
  return visit;
}

async function schedulePredictiveReminders(visitId: string, customerId: string, motorcycleId: string | undefined, kmReal: number | undefined, services: string[]) {
  const reminders: Array<{ type: string; message: string; dueDate: Date }> = [];
  
  if (services.some(s => /aceite|oil|cambio/i.test(s))) {
    const dueDate = new Date(); 
    dueDate.setDate(dueDate.getDate() + OIL_CHANGE_DAYS);
    const kmMsg = kmReal ? ` (aprox. km ${(kmReal + OIL_CHANGE_KM).toLocaleString('es-CO')})` : '';
    reminders.push({ 
      type: 'OIL_CHANGE', 
      message: `Cambio de aceite programado${kmMsg}. Basado en visita ${visitId.slice(-6).toUpperCase()}.`, 
      dueDate 
    });
  }
  
  if (services.some(s => /frenos?|brake/i.test(s))) {
    const dueDate = new Date(); 
    dueDate.setDate(dueDate.getDate() + 180);
    reminders.push({ 
      type: 'MAINTENANCE', 
      message: 'Revisión de frenos recomendada en 6 meses.', 
      dueDate 
    });
  }
  
  for (const r of reminders) {
    await prisma.reminders.create({ 
      data: { 
        customer_id: customerId, 
        type: r.type, 
        message: r.message, 
        due_date: r.dueDate 
      } as any 
    });
  }
}

export async function listWorkshopVisits(params: { customerId?: string; motorcycleId?: string; page: number; limit: number; }) {
  const { customerId, motorcycleId, page, limit } = params;
  const skip = (page - 1) * limit;
  const where: any = {
    ...(customerId && { customer_id: customerId }),
    ...(motorcycleId && { motorcycle_id: motorcycleId })
  };
  const [items, total] = await prisma.$transaction([
    prisma.workshop_visits.findMany({
      where,
      skip,
      take: limit,
      orderBy: { created_at: 'desc' },
      include: { 
        customers: { select: { id: true, name: true, phone: true } },
        motorcycles: { select: { id: true, plate: true, brand: true, model: true } }
      }
    }),
    prisma.workshop_visits.count({ where }),
  ]);
  return { data: items, meta: { total, page, limit, totalPages: Math.ceil(total / limit) } };
}

export async function getWorkshopSummary(customerId: string) {
  const visits = await prisma.workshop_visits.findMany({ 
    where: { customer_id: customerId }, 
    orderBy: { created_at: 'desc' }, 
    include: { motorcycles: { select: { plate: true, brand: true, model: true } } } 
  });
  const totalSpent = visits.reduce((s, v) => s + parseFloat(String(v.total_cost)), 0);
  return { visits, totalSpent, visitCount: visits.length };
}

