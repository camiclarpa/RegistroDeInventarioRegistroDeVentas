import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/authMiddleware';
import { prisma } from '../config/prisma';
import * as financeController from '../controllers/financeController';
import { logger } from '../config/logger';

const router = Router();
router.use(authenticate);

// ─── Rutas originales con controller ─────────────────────────────────────
router.get('/transactions', financeController.listRegisters);
router.get('/debts/receivables', financeController.getReceivables);
router.get('/receivables', financeController.getReceivables);

// ─── Aliases para frontend ───────────────────────────────────────────────
router.get('/accounts-receivable', financeController.getReceivables);

// ─── GET /finance/summary - Handler específico SIN requerir id ───────────
router.get('/summary', async (req: Request, res: Response) => {
  try {
    // Resumen global de finanzas (sin requerir cash_register_id)
    const [incomeResult, expenseResult] = await Promise.all([
      prisma.financial_transactions.aggregate({
        where: { type: 'INCOME' },
        _sum: { amount: true }
      }),
      prisma.financial_transactions.aggregate({
        where: { type: 'EXPENSE' },
        _sum: { amount: true }
      })
    ]);

    const totalIncome = Number(incomeResult._sum.amount) || 0;
    const totalExpenses = Number(expenseResult._sum.amount) || 0;

    const summary = {
      totalIncome,
      totalExpenses,
      netBalance: totalIncome - totalExpenses,
      currency: 'COP',
      period: 'all-time'
    };

    return res.json({ success: true, data: summary });
  } catch (error: any) {
    logger.error('[Finance] summary error:', error);
    return res.status(500).json({ 
      success: false, 
      error: 'Error al obtener resumen financiero' 
    });
  }
});

export default router;
