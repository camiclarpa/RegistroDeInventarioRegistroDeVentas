import { useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { Download, RefreshCw, BarChart3, Package, TrendingUp, DollarSign } from 'lucide-react'
import { toast } from 'sonner'
import { reportService } from '@/services/reportService'
import type { AbcProduct, InventoryValuation, ProfitabilityProductItem, ValuationCategoryItem } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card, CardHeader, CardBody } from '@/components/ui/Card'
import { Badge } from '@/components/ui/Badge'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { formatCOP, formatPct } from '@/utils/formatters'
import { exportAbcToExcel, exportProfitabilityToExcel } from '@/utils/excelExport'
import { todayISO, startOfMonthISO } from '@/utils/helpers'

type Tab = 'abc' | 'valuation' | 'rotation' | 'profitability'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'abc', label: 'Curva ABC', icon: <BarChart3 className="w-4 h-4" /> },
  { id: 'valuation', label: 'Valorización', icon: <Package className="w-4 h-4" /> },
  { id: 'rotation', label: 'Rotación', icon: <TrendingUp className="w-4 h-4" /> },
  { id: 'profitability', label: 'Rentabilidad', icon: <DollarSign className="w-4 h-4" /> },
]

export default function Reports() {
  const [activeTab, setActiveTab] = useState<Tab>('abc')
  const [loading, setLoading] = useState(false)
  const [startDate, setStartDate] = useState(startOfMonthISO())
  const [endDate, setEndDate] = useState(todayISO())

  // Estados tipados correctamente
  const [abcData, setAbcData] = useState<AbcProduct[]>([])
  const [valuationData, setValuationData] = useState<InventoryValuation | null>(null)
  const [rotationData, setRotationData] = useState<AbcProduct[]>([])
  const [profitabilityData, setProfitabilityData] = useState<ProfitabilityProductItem[]>([])

  const loadData = async (tab: Tab) => {
    setLoading(true)
    const params = { startDate, endDate }
    try {
      switch (tab) {
        case 'abc': {
          const res = await reportService.getAbcAnalysis(params)
          setAbcData(res.products ?? [])
          break
        }
        case 'valuation': {
          const res = await reportService.getInventoryValuation()
          setValuationData(res)
          break
        }
        case 'rotation': {
          const res = await reportService.getProductRotation(params)
          setRotationData(res.products ?? [])
          break
        }
        case 'profitability': {
          const res = await reportService.getProfitability(params)
          setProfitabilityData(res.byProduct ?? [])
          break
        }
      }
    } catch {
      toast.error('Error al cargar el reporte')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadData(activeTab) }, [activeTab]) // eslint-disable-line react-hooks/exhaustive-deps

  const handleRefresh = () => loadData(activeTab)

  const handleExport = async () => {
    try {
      if (activeTab === 'abc' && abcData.length > 0) await exportAbcToExcel(abcData)
      else if (activeTab === 'profitability' && profitabilityData.length > 0) await exportProfitabilityToExcel(profitabilityData)
      else { toast.warning('Sin datos para exportar'); return }
      toast.success('Excel exportado')
    } catch {
      toast.error('Error al exportar')
    }
  }

  // Datos derivados para gráficos
  const abcChartData = abcData.slice(0, 10).map(item => ({
    name: item.productName.slice(0, 15),
    revenue: item.totalRevenue,
  }))

  const valuationChartData = (valuationData?.byCategory ?? []).slice(0, 10).map((v: ValuationCategoryItem) => ({
    name: v.category.slice(0, 15),
    costo: v.costValue,
    venta: v.saleValue,
  }))

  return (
    <div>
      <PageHeader
        title="Reportes y Analítica"
        description="Análisis del desempeño del negocio"
        actions={
          <div className="flex gap-2">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="input-field text-sm" />
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="input-field text-sm" />
            <button className="btn-outline btn-sm" onClick={handleRefresh} disabled={loading}><RefreshCw className="w-4 h-4" /> Actualizar</button>
            <button className="btn-outline btn-sm" onClick={handleExport}><Download className="w-4 h-4" /> Exportar</button>
          </div>
        }
      />

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200 mb-6">
        {TABS.map((tab) => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${activeTab === tab.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500'}`}>
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      {/* Contenido de pestañas */}
      <div className="space-y-4">
        {loading && <div className="h-64 bg-gray-100 rounded animate-pulse" />}

        {!loading && activeTab === 'abc' && (
          <>
            <div className="grid grid-cols-3 gap-4">
              {(['A', 'B', 'C'] as const).map(cls => (
                <Card key={cls} className="p-4">
                  <p className="text-sm text-gray-500">Clase {cls}</p>
                  <p className="text-2xl font-bold">{abcData.filter(i => i.abcClass === cls).length} productos</p>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader>Diagrama de Pareto (Top 10)</CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={abcChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: number) => formatCOP(v)} /><Legend /><Bar dataKey="revenue" name="Ingresos" fill="#1e3a8a" /></BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
            <Card>
              <CardHeader>Detalle Clasificación ABC</CardHeader>
              <div className="overflow-x-auto max-h-96">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="table-th">Producto</th><th className="table-th">Clase</th><th className="table-th">Ingresos</th><th className="table-th">% Acum.</th></tr></thead>
                  <tbody>
                    {abcData.map((item, idx) => (
                      <tr key={item.productId} className="table-row">
                        <td className="table-td">{item.productName}</td>
                        <td className="table-td"><Badge variant={item.abcClass === 'A' ? 'green' : item.abcClass === 'B' ? 'yellow' : 'red'}>{item.abcClass}</Badge></td>
                        <td className="table-td">{formatCOP(item.totalRevenue)}</td>
                        <td className="table-td">{formatPct(item.cumulativePercentage)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {!loading && activeTab === 'valuation' && (
          <>
            <Card>
              <CardHeader>Valorización por Categoría</CardHeader>
              <CardBody>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={valuationChartData}><CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="name" /><YAxis /><Tooltip formatter={(v: number) => formatCOP(v)} /><Legend /><Bar dataKey="costo" name="Costo" fill="#1e3a8a" /><Bar dataKey="venta" name="Venta" fill="#f97316" /></BarChart>
                </ResponsiveContainer>
              </CardBody>
            </Card>
            <Card>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50"><tr><th className="table-th">Categoría</th><th className="table-th">Productos</th><th className="table-th">Unidades</th><th className="table-th">Valor Costo</th><th className="table-th">Valor Venta</th></tr></thead>
                  <tbody>
                    {(valuationData?.byCategory ?? []).map((v, idx) => (
                      <tr key={idx} className="table-row">
                        <td className="table-td">{v.category}</td>
                        <td className="table-td">{v.productCount}</td>
                        <td className="table-td">{v.totalUnits}</td>
                        <td className="table-td">{formatCOP(v.costValue)}</td>
                        <td className="table-td text-orange-600">{formatCOP(v.saleValue)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {!loading && activeTab === 'rotation' && (
          <Card>
            <CardHeader>Top 15 Productos más Vendidos</CardHeader>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-gray-50"><tr><th className="table-th">Producto</th><th className="table-th">SKU</th><th className="table-th">Vendidos</th><th className="table-th">Ingresos</th></tr></thead>
                <tbody>
                  {rotationData.slice(0, 15).map((r, idx) => (
                    <tr key={r.productId} className="table-row">
                      <td className="table-td">{r.productName}</td>
                      <td className="table-td text-gray-500">{r.sku}</td>
                      <td className="table-td"><Badge variant="blue">{r.quantitySold}</Badge></td>
                      <td className="table-td font-semibold">{formatCOP(r.totalRevenue)}</td>
                    </tr>
                  ))}
                  {rotationData.length === 0 && <tr><td colSpan={4} className="table-td text-center text-gray-400">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {!loading && activeTab === 'profitability' && (
          <Card>
            <CardHeader>Rentabilidad por Producto</CardHeader>
            <div className="overflow-x-auto max-h-96">
              <table className="w-full">
                <thead className="bg-gray-50"><tr><th className="table-th">Producto</th><th className="table-th">Ingresos</th><th className="table-th">Costo</th><th className="table-th">Ganancia</th><th className="table-th">Margen</th></tr></thead>
                <tbody>
                  {profitabilityData.map((p, idx) => (
                    <tr key={p.productId} className="table-row">
                      <td className="table-td">{p.productName}</td>
                      <td className="table-td">{formatCOP(p.totalRevenue)}</td>
                      <td className="table-td text-red-600">{formatCOP(p.totalCost)}</td>
                      <td className="table-td text-green-700">{formatCOP(p.grossProfit)}</td>
                      <td className="table-td"><Badge variant={p.profitMarginPercentage >= 30 ? 'green' : 'yellow'}>{formatPct(p.profitMarginPercentage)}</Badge></td>
                    </tr>
                  ))}
                  {profitabilityData.length === 0 && <tr><td colSpan={5} className="table-td text-center text-gray-400">Sin datos</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
