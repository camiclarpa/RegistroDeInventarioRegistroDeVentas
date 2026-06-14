import { Request, Response } from 'express'
import { prisma } from '../config/prisma'
import { logger } from '../config/logger'

const ok = (res: Response, result: any, status = 200) =>
  res.status(status).json({ success: true, result })
const fail = (res: Response, error: string, status = 400) =>
  res.status(status).json({ success: false, error })

export async function getABCCurve(req: Request, res: Response): Promise<Response> {
  try {
    const { startDate, endDate } = req.query as Record<string, string>
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    end.setHours(23, 59, 59, 999)

    const saleItems = await prisma.sale_items.findMany({
      where: {
        sales: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' }
      },
      include: {
        products: {
          include: { categories: true, brands: true }
        }
      },
      orderBy: { lineTotal: 'desc' }
    })

    const byProduct = saleItems.reduce((acc, item) => {
      const qty = Number(item.quantity || 0)
      const revenue = Number(item.lineTotal || 0)
      const prod = item.products

      acc[item.productId] = acc[item.productId] || {
        name: prod?.nameCommercial || 'N/A',
        category: prod?.categories?.name,
        brand: prod?.brands?.name,
        quantity: 0,
        revenue: 0
      }
      acc[item.productId].quantity += qty
      acc[item.productId].revenue += revenue
      return acc
    }, {} as Record<string, any>)

    const productsArray = Object.entries(byProduct)
      .map(([id, data]: [string, any]) => ({ productId: id, ...data }))
      .sort((a: any, b: any) => b.revenue - a.revenue)

    const totalRevenue = productsArray.reduce((s: number, p: any) => s + p.revenue, 0)
    let cumulative = 0
    const classified = productsArray.map((p: any) => {
      cumulative += p.revenue
      const pct = totalRevenue > 0 ? (cumulative / totalRevenue) * 100 : 0
      let abcClass: 'A' | 'B' | 'C' = 'C'
      if (pct <= 80) abcClass = 'A'
      else if (pct <= 95) abcClass = 'B'
      return { ...p, abcClass, cumulativePercentage: parseFloat(pct.toFixed(2)) }
    })

    const summary = {
      A: classified.filter((p: any) => p.abcClass === 'A'),
      B: classified.filter((p: any) => p.abcClass === 'B'),
      C: classified.filter((p: any) => p.abcClass === 'C')
    }

    return ok(res, {
      period: { start, end },
      totalRevenue,
      totalProducts: classified.length,
      summary: {
        A: { count: summary.A.length, revenue: summary.A.reduce((s: number, p: any) => s + p.revenue, 0) },
        B: { count: summary.B.length, revenue: summary.B.reduce((s: number, p: any) => s + p.revenue, 0) },
        C: { count: summary.C.length, revenue: summary.C.reduce((s: number, p: any) => s + p.revenue, 0) }
      },
      products: classified
    })
  } catch (err: any) {
    logger.error('[reportsController] getABCCurve', { err: err.message })
    return fail(res, 'Error: ' + err.message, 500)
  }
}

export async function getSalesSummary(req: Request, res: Response): Promise<Response> {
  try {
    const { startDate, endDate } = req.query as Record<string, string>
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()
    end.setHours(23, 59, 59, 999)

    const sales = await prisma.sales.findMany({
      where: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' }
    })

    const totalSales = sales.length
    const totalRevenue = sales.reduce((sum, s: any) => sum + Number(s.totalAmount || 0), 0)
    const totalTax = sales.reduce((sum, s: any) => sum + Number(s.taxAmount || 0), 0)

    const byPaymentMethod = Object.entries(
      sales.reduce((acc: any, s: any) => {
        const key = s.paymentMethod || 'UNKNOWN'
        if (!acc[key]) acc[key] = { count: 0, amount: 0 }
        acc[key].count++
        acc[key].amount += Number(s.totalAmount || 0)
        return acc
      }, {})
    ).map(([method, data]: [string, any]) => ({ method, ...data }))

    return ok(res, { period: { start, end }, totalSales, totalRevenue, totalTax, byPaymentMethod })
  } catch (err: any) {
    logger.error('[reportsController] getSalesSummary', { err: err.message })
    return fail(res, 'Error: ' + err.message, 500)
  }
}

export async function getInventoryValuation(req: Request, res: Response): Promise<Response> {
  try {
    const products = await prisma.products.findMany({
      where: { isActive: true },
      include: {
        categories: { select: { name: true } },
        brands: { select: { name: true } }
      }
    })

    const valuation = products.map((p: any) => {
      const costPrice = Number(p.costPriceAvg || 0)
      const salePrice = Number(p.salePriceBase || 0)
      const stock = Number(p.stockQuantity || 0)

      return {
        productId: p.id,
        name: p.nameCommercial,
        sku: p.skuInternal,
        category: p.categories?.name,
        brand: p.brands?.name,
        stock,
        costPrice,
        salePrice,
        totalCost: stock * costPrice,
        totalValue: stock * salePrice,
        margin: salePrice > 0 ? parseFloat(((salePrice - costPrice) / salePrice * 100).toFixed(2)) : 0
      }
    })

    return ok(res, {
      products: valuation,
      totals: {
        totalProducts: valuation.length,
        totalStock: valuation.reduce((s: any, p: any) => s + p.stock, 0),
        totalCostValue: valuation.reduce((s: any, p: any) => s + p.totalCost, 0),
        totalSaleValue: valuation.reduce((s: any, p: any) => s + p.totalValue, 0)
      }
    })
  } catch (err: any) {
    logger.error('[reportsController] getInventoryValuation', { err: err.message })
    return fail(res, 'Error: ' + err.message, 500)
  }
}

export async function getInventoryTurnover(req: Request, res: Response): Promise<Response> {
  try {
    const { startDate, endDate } = req.query as Record<string, string>
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const products = await prisma.products.findMany({ where: { isActive: true } })
    const saleItems = await prisma.sale_items.findMany({
      where: { sales: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' } }
    })

    const soldByProduct = saleItems.reduce((acc, item) => {
      acc[item.productId] = (acc[item.productId] || 0) + Number(item.quantity || 0)
      return acc
    }, {} as Record<string, number>)

    const days = Math.max(1, Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)))
    const turnover = products
      .filter((p: any) => (p.stockQuantity || 0) > 0)
      .map((p: any) => {
        const stock = Number(p.stockQuantity || 0)
        const sold = soldByProduct[p.id] || 0
        const rate = stock > 0 ? sold / stock : 0
        return {
          productId: p.id,
          name: p.nameCommercial,
          sku: p.skuInternal,
          currentStock: stock,
          soldInPeriod: sold,
          turnoverRate: parseFloat(rate.toFixed(2)),
          daysOfStock: rate > 0 ? Math.round(days / rate) : null
        }
      }).sort((a: any, b: any) => b.turnoverRate - a.turnoverRate)

    return ok(res, {
      period: { start, end },
      products: turnover,
      summary: {
        avgTurnover: turnover.map((p: any) => p.turnoverRate).reduce((a: number, b: number) => a + b, 0) / (turnover.length || 1),
        slowMovers: turnover.filter((p: any) => p.turnoverRate < 0.5).length,
        fastMovers: turnover.filter((p: any) => p.turnoverRate > 2).length
      }
    })
  } catch (err: any) {
    logger.error('[reportsController] getInventoryTurnover', { err: err.message })
    return fail(res, 'Error: ' + err.message, 500)
  }
}

export async function getProfitability(req: Request, res: Response): Promise<Response> {
  try {
    const { startDate, endDate } = req.query as Record<string, string>
    const start = startDate ? new Date(startDate) : new Date(Date.now() - 4 * 24 * 60 * 60 * 1000)
    const end = endDate ? new Date(endDate) : new Date()

    const saleItems = await prisma.sale_items.findMany({
      where: { sales: { createdAt: { gte: start, lte: end }, status: 'COMPLETED' } },
      include: { products: { include: { categories: true } } }
    })

    const profitability = saleItems.reduce((acc, item) => {
      const product = item.products
      const cost = Number(product?.costPriceAvg || 0) * Number(item.quantity || 0)
      const revenue = Number(item.lineTotal || 0)

      const key = item.productId
      if (!acc[key]) {
        acc[key] = {
          productId: item.productId,
          productName: product?.nameCommercial || 'N/A',
          category: product?.categories?.name,
          quantity: 0,
          revenue: 0,
          cost: 0
        }
      }
      acc[key].quantity += Number(item.quantity || 0)
      acc[key].revenue += revenue
      acc[key].cost += cost
      return acc
    }, {} as Record<string, any>)

    const result = Object.values(profitability).map((p: any) => {
      const profit = p.revenue - p.cost
      return { ...p, profit, margin: p.revenue > 0 ? parseFloat((profit / p.revenue * 100).toFixed(2)) : 0 }
    }).sort((a: any, b: any) => b.profit - a.profit)

    return ok(res, {
      period: { start, end },
      products: result,
      totals: {
        revenue: result.reduce((s: number, p: any) => s + p.revenue, 0),
        cost: result.reduce((s: number, p: any) => s + p.cost, 0),
        profit: result.reduce((s: number, p: any) => s + p.profit, 0)
      }
    })
  } catch (err: any) {
    logger.error('[reportsController] getProfitability', { err: err.message })
    return fail(res, 'Error: ' + err.message, 500)
  }
}

