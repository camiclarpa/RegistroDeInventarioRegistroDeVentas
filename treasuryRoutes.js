const express = require('express');
const router = express.Router();
const { prisma } = require('../config/prisma');

function toFloat(v) { return parseFloat(String(v || 0)) || 0; }

router.get('/summary', async (req, res) => {
  try {
    const config = await prisma.treasuryConfig.findFirst();
    const initial = toFloat(config?.initialBalance);
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const movs = await prisma.treasuryMovement.findMany({ where: { date: { gte: today, lt: tomorrow } } });
    const sales = movs.filter(m => m.type === 'INGRESS').reduce((a,b) => a + toFloat(b.amount), 0);
    const exp = movs.filter(m => m.type === 'EXPENSE').reduce((a,b) => a + toFloat(b.amount), 0);
    res.json({ success: true, data: { initialBalance: initial, dailySales: sales, dailyExpenses: exp, expectedBalance: initial + sales - exp } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/open', async (req, res) => {
  try {
    const { openingBalance, notes, userId } = req.body;
    const exists = await prisma.cashRegisters.findFirst({ where: { status: 'OPEN' } });
    if (exists) return res.status(400).json({ success: false, error: 'Ya hay una caja abierta' });
    const box = await prisma.cashRegisters.create({
      data: { id: 'cr-'+Date.now(), openedByUserId: userId || 'system', openingBalance: toFloat(openingBalance), status: 'OPEN', openedAt: new Date(), notes: notes||'' }
    });
    await prisma.treasuryMovement.create({
      data: { type: 'OPENING', description: 'Apertura de caja', amount: toFloat(openingBalance), date: new Date(), userId: userId }
    });
    res.json({ success: true, message: 'Caja abierta', data: { cashRegister: box } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/cash-register/current', async (req, res) => {
  try {
    const box = await prisma.cashRegisters.findFirst({ where: { status: 'OPEN' }, include: { openedBy: { select: { id: true, name: true } } } });
    if (!box) return res.json({ success: false, error: 'No hay caja abierta' });
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const movs = await prisma.treasuryMovement.findMany({ where: { date: { gte: today, lt: tomorrow } } });
    const inc = movs.filter(m => m.type === 'INGRESS').reduce((a,b) => a + toFloat(b.amount), 0);
    const exp = movs.filter(m => m.type === 'EXPENSE').reduce((a,b) => a + toFloat(b.amount), 0);
    res.json({ success: true, data: { cashRegister: box, currentBalance: toFloat(box.openingBalance) + inc - exp, totalIncomes: inc, totalExpenses: exp } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.get('/transactions', async (req, res) => {
  try {
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const movs = await prisma.treasuryMovement.findMany({ where: { date: { gte: today, lt: tomorrow } }, orderBy: { date: 'desc' } });
    res.json({ success: true, data: { transactions: movs, count: movs.length } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

router.post('/close-cash', async (req, res) => {
  try {
    const { finalBalance, observations, userId } = req.body;
    const config = await prisma.treasuryConfig.findFirst();
    const initial = toFloat(config?.initialBalance);
    const today = new Date(); today.setHours(0,0,0,0);
    const tomorrow = new Date(today); tomorrow.setDate(tomorrow.getDate() + 1);
    const movs = await prisma.treasuryMovement.findMany({ where: { date: { gte: today, lt: tomorrow } } });
    const inc = movs.filter(m => m.type === 'INGRESS').reduce((a,b) => a + toFloat(b.amount), 0);
    const exp = movs.filter(m => m.type === 'EXPENSE').reduce((a,b) => a + toFloat(b.amount), 0);
    const expected = initial + inc - exp;
    const diff = finalBalance - expected;
    if (Math.abs(diff) > 100) return res.status(400).json({ success: false, error: 'Diferencia mayor a 100. Revisa el arqueo.' });
    let box = await prisma.cashRegisters.findFirst({ where: { status: 'OPEN' } });
    if (!box) {
      box = await prisma.cashRegisters.create({ data: { id: 'cr-'+Date.now(), openedByUserId: userId||'system', openingBalance: initial, status: 'OPEN', openedAt: today, notes: 'Auto' } });
    }
    const closed = await prisma.cashRegisters.update({ where: { id: box.id }, data: { closedByUserId: userId||'system', closingBalance: finalBalance, expectedClosingBalance: expected, difference: diff, status: 'CLOSED', closedAt: new Date(), notes: observations||'' } });
    res.json({ success: true, message: 'Caja cerrada exitosamente', data: { cashRegister: closed, summary: { initialBalance: initial, totalIncomes: inc, totalExpenses: exp, expectedBalance: expected, finalBalance, difference: diff } } });
  } catch(e) { res.status(500).json({ success: false, error: e.message }); }
});

module.exports = router;
