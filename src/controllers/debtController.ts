import type { Request, Response } from 'express'
import { z } from 'zod'
import { prisma } from '../config/prisma'
import { logger } from '../config/logger'

const ok = (res: Response, data: unknown, status = 200) => res.status(status).json({ success: true, data })
const fail = (res: Response, msg: string, status = 400) => res.status(status).json({ success: false, error: msg })

const paymentSchema = z.object({
  amount: z.number().positive('El monto debe ser mayor a 0'),
  paymentMethod: z.enum(['CASH', 'CARD', 'TRANSFER', 'MIXED']).default('CASH'),
  notes: z.string().optional(),
  referenceDoc: z.string().optional(),
})

export async function listDebts(req: Request, res: Response): Promise<Response> {
  try {
    const { status, customerId, page = '1', limit = '50' } = req.query as Record<string, string>
    const skip = (Number(page) - 1) * Number(limit)

    const where: any = {}
    if (status) {
      where.status = status
    } else {
      where.status = { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] }
    }
    if (customerId) where.customerId = customerId

    const [debts, total] = await Promise.all([
      prisma.accounts_receivable.findMany({
        where,
        skip,
        take: Number(limit),
        orderBy: { createdAt: 'desc' },
        include: {
          customers: { select: { id: true, name: true, phone: true, email: true, identificationNumber: true } },
          sales: { select: { id: true, saleNumber: true, createdAt: true, totalAmount: true, paymentMethod: true } },
          payment_records: {
            orderBy: { timestamp: 'desc' },
            take: 5,
          },
        },
      }),
      prisma.accounts_receivable.count({ where }),
    ])

    return ok(res, { data: debts, total, page: Number(page), limit: Number(limit), totalPages: Math.ceil(total / Number(limit)) })
  } catch (err) {
    logger.error('[debtController] listDebts', { err })
    return fail(res, 'Error al obtener cuentas por cobrar', 500)
  }
}

export async function getDebtById(req: Request, res: Response): Promise<Response> {
  try {
    const debt = await prisma.accounts_receivable.findUnique({
      where: { id: String(req.params['id']) },
      include: {
        customers: true,
        sales: { include: { sale_items: { include: { products: { select: { nameCommercial: true, skuInternal: true } } } } } },
        payment_records: { orderBy: { timestamp: 'asc' } },
      },
    })
    if (!debt) return fail(res, 'Cuenta por cobrar no encontrada.', 404)
    return ok(res, debt)
  } catch (err) {
    logger.error('[debtController] getDebtById', { err })
    return fail(res, 'Error al obtener cuenta por cobrar', 500)
  }
}

export async function registerPayment(req: Request, res: Response): Promise<Response> {
  try {
    const id = String(req.params['id'])
    const userId = (req.user as any)?.id
    if (!userId) return fail(res, 'No autenticado', 401)

    const parsed = paymentSchema.safeParse({ ...req.body, amount: Number(req.body.amount) })
    if (!parsed.success) return fail(res, parsed.error.issues.map(e => e.message).join(', '))

    const { amount, paymentMethod, notes, referenceDoc } = parsed.data

    const debt = await prisma.accounts_receivable.findUnique({ where: { id } })
    if (!debt) return fail(res, 'Cuenta por cobrar no encontrada.', 404)
    if (debt.status === 'PAID') return fail(res, 'Esta cuenta ya está pagada.')

    const remaining = Number(debt.remainingBalance)
    if (amount > remaining + 0.01) return fail(res, `El monto (${amount}) supera el saldo restante (${remaining.toFixed(2)}).`)

    const actualAmount = Math.min(amount, remaining)
    const newPaid = Number(debt.paidAmount) + actualAmount
    const newRemaining = Math.max(0, remaining - actualAmount)
    const newStatus = newRemaining <= 0.01 ? 'PAID' : 'PARTIALLY_PAID'

    const [updatedDebt, payment] = await prisma.$transaction([
      prisma.accounts_receivable.update({
        where: { id },
        data: { paidAmount: newPaid, remainingBalance: newRemaining, status: newStatus } as any,
        include: { customers: { select: { name: true } } },
      }),
      prisma.payment_records.create({
        data: {
          accountReceivableId: id,
          amount: actualAmount,
          paymentMethod,
          referenceDoc: referenceDoc ?? null,
          note: notes ?? null,
          performedByUserId: userId,
        } as any,
      }),
    ])

    logger.info('[debtController] Payment registered', { debtId: id, amount: actualAmount, newStatus, userId })
    return ok(res, { debt: updatedDebt, payment, saldoRestante: newRemaining, message: newStatus === 'PAID' ? 'Cuenta pagada en su totalidad.' : `Abono registrado. Saldo restante: ${newRemaining.toFixed(2)}.` })
  } catch (err) {
    logger.error('[debtController] registerPayment', { err })
    return fail(res, 'Error al registrar el pago', 500)
  }
}

export async function getDebtsSummary(_req: Request, res: Response): Promise<Response> {
  try {
    const [pending, partial, overdue, totalAgg] = await Promise.all([
      prisma.accounts_receivable.count({ where: { status: 'PENDING' } }),
      prisma.accounts_receivable.count({ where: { status: 'PARTIALLY_PAID' } }),
      prisma.accounts_receivable.count({ where: { status: 'OVERDUE' } }),
      prisma.accounts_receivable.aggregate({
        where: { status: { in: ['PENDING', 'PARTIALLY_PAID', 'OVERDUE'] } },
        _sum: { remainingBalance: true, totalDebt: true, paidAmount: true },
      }),
    ])
    return ok(res, {
      counts: { pending, partial, overdue, total: pending + partial + overdue },
      amounts: { totalDebt: Number(totalAgg._sum.totalDebt ?? 0), paidAmount: Number(totalAgg._sum.paidAmount ?? 0), remainingBalance: Number(totalAgg._sum.remainingBalance ?? 0) },
    })
  } catch (err) {
    logger.error('[debtController] getDebtsSummary', { err })
    return fail(res, 'Error al obtener resumen de deudas', 500)
  }
}

