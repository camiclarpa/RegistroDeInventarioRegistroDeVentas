import { useEffect, useState } from 'react';
import { BarChart2, Users, TrendingUp, AlertTriangle, RefreshCw, Target, DollarSign, Activity } from 'lucide-react';
import api from '@/services/api';

interface SegmentData {
  segment: string;
  count: number;
}

interface AgingData {
  bucket: string;
  count: number;
  amount: number;
}

interface KpiData {
  totalCustomers: number;
  activeCustomers: number;
  retentionRate: number;
  recentCommunications: number;
  openTickets: number;
  segmentDistribution: SegmentData[];
  agingDistribution: AgingData[];
}

const SEGMENT_CONFIG: Record<string, { label: string; color: string; bg: string; icon: string; description: string }> = {
  VIP:       { label: 'VIP',        color: 'text-purple-700',  bg: 'bg-purple-50 border-purple-200',  icon: '👑', description: 'Compran mucho, frecuente y reciente' },
  LOYAL:     { label: 'Leal',       color: 'text-blue-700',    bg: 'bg-blue-50 border-blue-200',      icon: '💎', description: 'Compran frecuente, monto moderado' },
  REGULAR:   { label: 'Regular',    color: 'text-green-700',   bg: 'bg-green-50 border-green-200',    icon: '✅', description: 'Compras moderadas y estables' },
  NEW:       { label: 'Nuevo',      color: 'text-cyan-700',    bg: 'bg-cyan-50 border-cyan-200',      icon: '🌟', description: 'Primera compra reciente' },
  AT_RISK:   { label: 'En Riesgo',  color: 'text-orange-700',  bg: 'bg-orange-50 border-orange-200',  icon: '⚠️', description: 'Compraban, ahora menos frecuente' },
  DORMANT:   { label: 'Dormido',    color: 'text-gray-700',    bg: 'bg-gray-50 border-gray-200',      icon: '💤', description: 'No compran hace 6-12 meses' },
  CHURNED:   { label: 'Perdido',    color: 'text-red-700',     bg: 'bg-red-50 border-red-200',        icon: '❌', description: 'No compran hace +1 año' },
};

const AGING_LABELS: Record<string, string> = {
  CURRENT: 'Al día',
  '1_30': '1-30 días',
  '31_60': '31-60 días',
  '61_90': '61-90 días',
  '90_PLUS': '+90 días',
};

export default function CRMAnalyticsPage() {
  const [kpis, setKpis] = useState<KpiData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadKpis = async () => {
    try {
      const res = await api.get('/crm/analytics/kpis');
      setKpis(res.data);
    } catch (err) {
      console.error('Error loading KPIs:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshRfm = async () => {
    setRefreshing(true);
    try {
      await api.get('/crm/analytics/rfm/refresh');
      await loadKpis();
      alert('✅ Segmentación RFM actualizada para todos los clientes');
    } catch (err) {
      alert('❌ Error al actualizar RFM');
    } finally {
      setRefreshing(false);
    }
  };

  useEffect(() => { loadKpis(); }, []);

  if (loading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-gray-500">Cargando analíticas...</div>
        </div>
      </div>
    );
  }

  const totalInSegments = kpis?.segmentDistribution.reduce((sum, s) => sum + s.count, 0) || 0;
  const maxSegmentCount = Math.max(...(kpis?.segmentDistribution.map(s => s.count) || [1]));
  const maxAgingAmount = Math.max(...(kpis?.agingDistribution.map(a => a.amount) || [1]));

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <BarChart2 className="text-indigo-600" size={28} />
            Analítica CRM
          </h1>
          <p className="text-sm text-gray-500 mt-1">Segmentación RFM y métricas clave del negocio</p>
        </div>
        <button
          onClick={handleRefreshRfm}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
          {refreshing ? 'Actualizando...' : 'Actualizar RFM'}
        </button>
      </div>

      {/* KPIs principales */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase">
            <Users size={14} /> Total Clientes
          </div>
          <p className="text-2xl font-bold text-gray-900 mt-2">{kpis?.totalCustomers || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase">
            <Activity size={14} /> Activos (30d)
          </div>
          <p className="text-2xl font-bold text-green-600 mt-2">{kpis?.activeCustomers || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase">
            <TrendingUp size={14} /> Retención
          </div>
          <p className="text-2xl font-bold text-blue-600 mt-2">{kpis?.retentionRate || 0}%</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase">
            <DollarSign size={14} /> Comunicaciones
          </div>
          <p className="text-2xl font-bold text-purple-600 mt-2">{kpis?.recentCommunications || 0}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-gray-500 text-xs font-medium uppercase">
            <AlertTriangle size={14} /> Tickets Abiertos
          </div>
          <p className="text-2xl font-bold text-orange-600 mt-2">{kpis?.openTickets || 0}</p>
        </div>
      </div>

      {/* Segmentación RFM */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Target className="text-indigo-600" size={20} />
          <h2 className="text-lg font-bold text-gray-900">Segmentación RFM</h2>
          <span className="text-xs text-gray-500 ml-2">
            Recencia × Frecuencia × Monto (últimos 6 meses)
          </span>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
          {Object.entries(SEGMENT_CONFIG).map(([key, config]) => {
            const data = kpis?.segmentDistribution.find(s => s.segment === key);
            const count = data?.count || 0;
            const percentage = totalInSegments > 0 ? Math.round((count / totalInSegments) * 100) : 0;
            const barWidth = maxSegmentCount > 0 ? (count / maxSegmentCount) * 100 : 0;
            
            return (
              <div key={key} className={`rounded-lg border p-4 ${config.bg}`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xl">{config.icon}</span>
                    <span className={`font-bold ${config.color}`}>{config.label}</span>
                  </div>
                  <span className={`text-2xl font-bold ${config.color}`}>{count}</span>
                </div>
                <p className="text-xs text-gray-600 mb-2">{config.description}</p>
                <div className="w-full bg-white/50 rounded-full h-2">
                  <div
                    className={`h-2 rounded-full ${config.color.replace('text-', 'bg-')}`}
                    style={{ width: `${barWidth}%` }}
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">{percentage}% del total</p>
              </div>
            );
          })}
        </div>

        {/* Leyenda RFM */}
        <div className="mt-4 p-3 bg-gray-50 rounded-lg text-xs text-gray-600">
          <p className="font-semibold mb-1">¿Cómo se calcula?</p>
          <ul className="space-y-0.5">
            <li>• <strong>VIP:</strong> Compra en últimos 30 días, +6 compras en 6 meses, +$500.000</li>
            <li>• <strong>Leal:</strong> Compra en últimos 60 días, +4 compras, +$200.000</li>
            <li>• <strong>Regular:</strong> Compra en últimos 90 días, +2 compras</li>
            <li>• <strong>Nuevo:</strong> Compra en últimos 90 días, 1 compra</li>
            <li>• <strong>En Riesgo:</strong> Compra en últimos 180 días, +2 compras</li>
            <li>• <strong>Dormido:</strong> Compra en últimos 365 días, +1 compra</li>
            <li>• <strong>Perdido:</strong> Sin compras en +1 año</li>
          </ul>
        </div>
      </div>

      {/* Aging de Cuentas por Cobrar */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-4">
          <DollarSign className="text-red-600" size={20} />
          <h2 className="text-lg font-bold text-gray-900">Antigüedad de Cuentas por Cobrar</h2>
        </div>
        
        {kpis?.agingDistribution && kpis.agingDistribution.length > 0 ? (
          <div className="space-y-3">
            {kpis.agingDistribution.map((aging) => {
              const barWidth = maxAgingAmount > 0 ? (aging.amount / maxAgingAmount) * 100 : 0;
              const isOverdue = aging.bucket !== 'CURRENT';
              const color = aging.bucket === 'CURRENT' ? 'bg-green-500' :
                           aging.bucket === '1_30' ? 'bg-yellow-500' :
                           aging.bucket === '31_60' ? 'bg-orange-500' :
                           aging.bucket === '61_90' ? 'bg-red-500' : 'bg-red-700';
              
              return (
                <div key={aging.bucket}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">
                      {AGING_LABELS[aging.bucket] || aging.bucket}
                    </span>
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-gray-500">{aging.count} cuentas</span>
                      <span className={`font-bold ${isOverdue ? 'text-red-600' : 'text-green-600'}`}>
                        ${aging.amount.toLocaleString('es-CO')}
                      </span>
                    </div>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className={`h-3 rounded-full ${color}`} style={{ width: `${barWidth}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400">
            <DollarSign size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm">No hay cuentas por cobrar pendientes</p>
          </div>
        )}
      </div>
    </div>
  );
}
