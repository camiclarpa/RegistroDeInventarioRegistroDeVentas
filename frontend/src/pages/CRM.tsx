import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import CreateCustomerModal from './crm/customers/CreateCustomerModal';
import crmService, {
  CrmCustomer, CrmCustomerListItem, CreditRecord,
  Warranty, CustomerSearchResult, LoyaltyTier,
} from '../services/crmService';

const TIER_CONFIG: Record<LoyaltyTier, { label: string; color: string; bg: string; next: number | null }> = {
  BRONZE: { label: 'Bronce',  color: 'text-amber-700',  bg: 'bg-amber-50  border-amber-200',  next: 5000  },
  SILVER: { label: 'Plata',   color: 'text-slate-600',  bg: 'bg-slate-50  border-slate-200',  next: 15000 },
  GOLD:   { label: 'Oro',     color: 'text-yellow-600', bg: 'bg-yellow-50 border-yellow-200', next: null  },
};

function TierBadge({ tier }: { tier: LoyaltyTier }) {
  const cfg = TIER_CONFIG[tier];
  return <span className={`px-2 py-0.5 rounded-full text-xs font-semibold border ${cfg.bg} ${cfg.color}`}>{cfg.label}</span>;
}

function LoyaltyProgress({ totalSpent, tier }: { totalSpent: number; tier: LoyaltyTier }) {
  const cfg = TIER_CONFIG[tier];
  if (!cfg.next) return <div className="text-xs text-yellow-600 font-semibold mt-1">★ Nivel máximo alcanzado</div>;
  const prev  = tier === 'BRONZE' ? 0 : 5000;
  const pct   = Math.min(100, ((totalSpent - prev) / (cfg.next - prev)) * 100);
  const left  = Math.max(0, cfg.next - totalSpent);
  return (
    <div className="mt-1">
      <div className="flex justify-between text-xs text-gray-500 mb-0.5">
        <span>{cfg.label}</span>
        <span>Faltan ${left.toLocaleString('es-CO')} para {tier === 'BRONZE' ? 'Plata' : 'Oro'}</span>
      </div>
      <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
        <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: CreditRecord['status'] }) {
  const map: Record<string, string> = {
    PENDING: 'bg-yellow-100 text-yellow-800', PARTIALLY_PAID: 'bg-blue-100 text-blue-800',
    PAID: 'bg-green-100 text-green-800', OVERDUE: 'bg-red-100 text-red-800',
  };
  const labels: Record<string, string> = {
    PENDING: 'Pendiente', PARTIALLY_PAID: 'Parcial', PAID: 'Pagado', OVERDUE: 'Vencido',
  };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? 'bg-gray-100 text-gray-700'}`}>{labels[status] ?? status}</span>;
}

function WarrantyBadge({ status }: { status: Warranty['status'] }) {
  const map: Record<string, string> = { ACTIVE: 'bg-green-100 text-green-800', CLAIMED: 'bg-purple-100 text-purple-800', EXPIRED: 'bg-gray-100 text-gray-500' };
  const labels: Record<string, string> = { ACTIVE: 'Activa', CLAIMED: 'Reclamada', EXPIRED: 'Vencida' };
  return <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${map[status] ?? ''}`}>{labels[status] ?? status}</span>;
}

function CustomerQuickCard({ customer, onClick }: { customer: CustomerSearchResult | CrmCustomerListItem; onClick: () => void; }) {
  const tier = (customer as any).loyaltyTier as LoyaltyTier;
  const plate = (customer as CustomerSearchResult).plate ?? (customer as CrmCustomerListItem).motorcycles?.[0]?.plate;
  return (
    <div onClick={onClick} className="flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-colors">
      <div>
        <p className="font-semibold text-gray-800 text-sm">{customer.name}</p>
        <p className="text-xs text-gray-500">{customer.phone ?? '—'}{plate && <span className="ml-2 font-mono text-blue-600">{plate}</span>}</p>
      </div>
      <div className="flex flex-col items-end gap-1">
        <TierBadge tier={tier} />
        {(customer as any).lastPurchaseAt && <span className="text-xs text-gray-400">{new Date((customer as any).lastPurchaseAt).toLocaleDateString('es-CO')}</span>}
      </div>
    </div>
  );
}

function PayModal({ credit, onClose, onSuccess }: { credit: CreditRecord; onClose: () => void; onSuccess: () => void; }) {
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('CASH');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const max = credit.remainingBalance;

  const handlePay = async () => {
    const val = parseFloat(amount);
    if (!val || val <= 0 || val > max) { setError(`Monto inválido (máx $${max.toLocaleString('es-CO')})`); return; }
    setLoading(true); setError('');
    try {
      await crmService.payCredit(credit.id, { amount: val, paymentMethod: method, notes });
      onSuccess(); onClose();
    } catch (e: any) { setError(e.response?.data?.error ?? e.message); }
    finally { setLoading(false); }
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
        <h3 className="text-lg font-bold mb-1">Registrar Abono</h3>
        <p className="text-sm text-gray-500 mb-4">Saldo pendiente: <strong>${max.toLocaleString('es-CO')}</strong></p>
        <div className="space-y-3">
          <div><label className="text-xs text-gray-600 font-medium">Monto</label>
            <input type="number" min={0} max={max} step={100} value={amount} onChange={e => setAmount(e.target.value)} placeholder="0" className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
          <div><label className="text-xs text-gray-600 font-medium">Método de pago</label>
            <select value={method} onChange={e => setMethod(e.target.value)} className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="CASH">Efectivo</option><option value="TRANSFER">Transferencia</option><option value="CARD">Tarjeta</option><option value="NEQUI">Nequi</option><option value="DAVIPLATA">Daviplata</option>
            </select></div>
          <div><label className="text-xs text-gray-600 font-medium">Notas (opcional)</label>
            <input type="text" value={notes} onChange={e => setNotes(e.target.value)} placeholder="Observaciones..." className="w-full mt-1 px-3 py-2 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" /></div>
        </div>
        {error && <p className="text-red-600 text-xs mt-3">{error}</p>}
        <div className="flex gap-2 mt-5">
          <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-sm text-gray-700 hover:bg-gray-50">Cancelar</button>
          <button onClick={handlePay} disabled={loading} className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-60">{loading ? 'Procesando...' : 'Registrar Abono'}</button>
        </div>
      </div>
    </div>
  );
}

function Customer360Panel({ customer, onClose, onRefresh }: { customer: CrmCustomer; onClose: () => void; onRefresh: () => void; }) {
  const [tab, setTab] = useState<'overview' | 'credits' | 'warranties' | 'logs'>('overview');
  const [payingCredit, setPayingCredit] = useState<CreditRecord | null>(null);
  const [claimId, setClaimId] = useState<string | null>(null);
  const [claimNotes, setClaimNotes] = useState('');
  const [newNote, setNewNote] = useState('');
  const [noteType, setNoteType] = useState('NOTE');
  const [saving, setSaving] = useState(false);

  const handleAddNote = async () => {
    if (!newNote.trim()) return;
    setSaving(true);
    try { await crmService.addLog({ customerId: customer.id, type: noteType, message: newNote }); setNewNote(''); onRefresh(); }
    finally { setSaving(false); }
  };

  const handleClaim = async (id: string) => {
    if (!claimNotes.trim()) return;
    setSaving(true);
    try { await crmService.claimWarranty(id, claimNotes); setClaimId(null); setClaimNotes(''); onRefresh(); }
    finally { setSaving(false); }
  };

  const tier = customer.loyaltyTier as LoyaltyTier;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-40 p-0 sm:p-4">
      <div className="bg-white w-full sm:max-w-2xl sm:rounded-xl shadow-2xl max-h-[95vh] flex flex-col">
        <div className="flex items-start justify-between p-5 border-b">
          <div>
            <div className="flex items-center gap-2"><h2 className="text-xl font-bold text-gray-900">{customer.name}</h2><TierBadge tier={tier} /></div>
            <p className="text-sm text-gray-500 mt-0.5">{customer.phone ?? '—'} · {customer.email ?? 'Sin email'}</p>
            {customer.motorcycles.length > 0 && <p className="text-sm text-blue-600 font-mono mt-0.5">{customer.motorcycles.map(m => m.plate).join(', ')}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-700 text-2xl leading-none">×</button>
        </div>
        <div className="grid grid-cols-4 divide-x border-b text-center">
          {[{ label: 'Compras', value: customer.purchaseCount }, { label: 'Total gastado', value: `$${customer.totalSpent.toLocaleString('es-CO')}` }, { label: 'Puntos', value: customer.loyaltyPoints.toLocaleString('es-CO') }, { label: 'Deuda', value: `$${customer.totalPendingDebt.toLocaleString('es-CO')}`, red: customer.totalPendingDebt > 0 }].map(k => (
            <div key={k.label} className="py-3 px-2"><p className={`text-base font-bold ${(k as any).red ? 'text-red-600' : 'text-gray-900'}`}>{k.value}</p><p className="text-xs text-gray-500">{k.label}</p></div>
          ))}
        </div>
        <div className="flex border-b px-5 gap-1">
          {[{ key: 'overview', label: 'Resumen' }, { key: 'credits', label: `Fiados (${customer.activeCredits.length})` }, { key: 'warranties', label: `Garantías (${customer.activeWarranties.length})` }, { key: 'logs', label: 'Bitácora' }].map(t => (
            <button key={t.key} onClick={() => setTab(t.key as any)} className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-800'}`}>{t.label}</button>
          ))}
        </div>
        <div className="overflow-y-auto flex-1 p-5">
          {tab === 'overview' && (
            <div className="space-y-4">
              <LoyaltyProgress totalSpent={customer.totalSpent} tier={tier} />
              {customer.creditLimit !== null && (
                <div className="p-3 rounded-lg border border-gray-200 bg-gray-50">
                  <p className="text-xs text-gray-500">Límite de crédito</p>
                  <p className="text-sm font-semibold">${customer.creditLimit.toLocaleString('es-CO')}<span className="text-gray-400 font-normal ml-1">(disponible: ${(customer.creditLimit - customer.totalPendingDebt).toLocaleString('es-CO')})</span></p>
                </div>
              )}
              {customer.recentSales.length > 0 && (
                <div><h4 className="text-xs text-gray-500 font-semibold uppercase mb-2">Últimas ventas</h4>
                  <div className="space-y-2">{customer.recentSales.map(s => (
                    <div key={s.id} className="flex justify-between items-center text-sm py-1 border-b border-gray-100">
                      <div><span className="font-mono text-xs text-gray-500">{s.saleNumber}</span>{s.motorcycle && <span className="ml-2 text-blue-600 text-xs">{s.motorcycle.plate}</span>}</div>
                      <div className="text-right"><p className="font-semibold">${Number(s.totalAmount).toLocaleString('es-CO')}</p><p className="text-xs text-gray-400">{new Date(s.createdAt).toLocaleDateString('es-CO')}</p></div>
                    </div>
                  ))}</div>
                </div>
              )}
              {customer.motorcycles.length > 0 && (
                <div><h4 className="text-xs text-gray-500 font-semibold uppercase mb-2">Motocicletas</h4>
                  <div className="space-y-2">{customer.motorcycles.map(m => (
                    <div key={m.id} className="flex items-center gap-3 p-2 rounded border border-gray-200 text-sm">
                      <span className="font-mono font-semibold text-blue-600">{m.plate}</span>
                      <span className="text-gray-700">{m.brand} {m.model}</span>
                      {m.year && <span className="text-gray-400 text-xs">{m.year}</span>}
                      {m.lastKm && <span className="text-gray-400 text-xs ml-auto">{m.lastKm.toLocaleString()} km</span>}
                    </div>
                  ))}</div>
                </div>
              )}
            </div>
          )}
          {tab === 'credits' && (
            <div className="space-y-3">
              {customer.activeCredits.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">Sin créditos activos</p> : customer.activeCredits.map(c => (
                <div key={c.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div><p className="text-sm font-semibold">{(c as any).sale?.saleNumber ?? c.saleId}</p>{c.dueDate && <p className="text-xs text-gray-500">Vence: {new Date(c.dueDate).toLocaleDateString('es-CO')}</p>}</div>
                    <StatusBadge status={c.status} />
                  </div>
                  <div className="grid grid-cols-3 gap-2 mt-2 text-center">
                    <div><p className="text-xs text-gray-400">Total</p><p className="text-sm font-semibold">${Number(c.totalDebt).toLocaleString('es-CO')}</p></div>
                    <div><p className="text-xs text-gray-400">Abonado</p><p className="text-sm font-semibold text-green-600">${Number(c.paidAmount).toLocaleString('es-CO')}</p></div>
                    <div><p className="text-xs text-gray-400">Pendiente</p><p className="text-sm font-semibold text-red-600">${Number(c.remainingBalance).toLocaleString('es-CO')}</p></div>
                  </div>
                  {c.status !== 'PAID' && <button onClick={() => setPayingCredit(c)} className="mt-3 w-full py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 font-medium">Registrar Abono</button>}
                </div>
              ))}
            </div>
          )}
          {tab === 'warranties' && (
            <div className="space-y-3">
              {customer.activeWarranties.length === 0 ? <p className="text-gray-400 text-sm text-center py-6">Sin garantías activas</p> : customer.activeWarranties.map(w => (
                <div key={w.id} className="border border-gray-200 rounded-lg p-3">
                  <div className="flex justify-between items-start">
                    <div><p className="text-sm font-semibold">{w.productName}</p><p className="text-xs text-gray-500">{w.days} días · Vence: {new Date(w.expiresAt).toLocaleDateString('es-CO')}</p></div>
                    <WarrantyBadge status={w.status} />
                  </div>
                  {w.status === 'ACTIVE' && (claimId === w.id ? (
                    <div className="mt-2 space-y-2">
                      <input type="text" value={claimNotes} onChange={e => setClaimNotes(e.target.value)} placeholder="Descripción del reclamo..." className="w-full px-3 py-1.5 border rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                      <div className="flex gap-2">
                        <button onClick={() => setClaimId(null)} className="flex-1 py-1.5 border rounded text-sm">Cancelar</button>
                        <button onClick={() => handleClaim(w.id)} disabled={saving} className="flex-1 py-1.5 bg-purple-600 text-white rounded text-sm hover:bg-purple-700 disabled:opacity-60">{saving ? '...' : 'Confirmar Reclamo'}</button>
                      </div>
                    </div>
                  ) : <button onClick={() => setClaimId(w.id)} className="mt-2 w-full py-1.5 border border-purple-300 text-purple-700 text-sm rounded-lg hover:bg-purple-50">Registrar Reclamo</button>)}
                </div>
              ))}
            </div>
          )}
          {tab === 'logs' && (
            <div className="space-y-4">
              <div className="flex gap-2">
                <select value={noteType} onChange={e => setNoteType(e.target.value)} className="px-2 py-1.5 border rounded-lg text-sm focus:outline-none w-36">
                  <option value="NOTE">Nota</option><option value="CALL">Llamada</option><option value="VISIT">Visita</option><option value="FOLLOW_UP">Seguimiento</option>
                </select>
                <input type="text" value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="Escribir interacción..." className="flex-1 px-3 py-1.5 border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" onKeyDown={e => e.key === 'Enter' && handleAddNote()} />
                <button onClick={handleAddNote} disabled={saving || !newNote.trim()} className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 disabled:opacity-60">+</button>
              </div>
              <div className="space-y-2">
                {customer.logs.length === 0 ? <p className="text-gray-400 text-sm text-center py-4">Sin registros</p> : customer.logs.map(log => (
                  <div key={log.id} className="flex gap-3 text-sm"><div className="w-1 bg-blue-200 rounded-full flex-shrink-0 mt-1" /><div className="flex-1"><p className="text-gray-800">{log.message}</p><p className="text-xs text-gray-400 mt-0.5">{log.type} · {new Date(log.createdAt).toLocaleString('es-CO')}</p></div></div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
      {payingCredit && <PayModal credit={payingCredit} onClose={() => setPayingCredit(null)} onSuccess={onRefresh} />}
    </div>
  );
}
type ActiveTab = 'clientes' | 'fiados' | 'garantias';

export default function CRM() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<ActiveTab>('clientes');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<CustomerSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [customerList, setCustomerList] = useState<CrmCustomerListItem[]>([]);
  const [listMeta, setListMeta] = useState({ total: 0, page: 1, totalPages: 1 });
  const [loadingList, setLoadingList] = useState(false);
  const [tierFilter, setTierFilter] = useState('');
  const [selected, setSelected] = useState<CrmCustomer | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const loadList = useCallback(async (page = 1) => {
    setLoadingList(true);
    try {
      const result = await crmService.list({ page, limit: 20, tier: tierFilter || undefined });
      setCustomerList(result.data);
      setListMeta({ total: result.meta.total, page: result.meta.page, totalPages: result.meta.totalPages });
    } finally { setLoadingList(false); }
  }, [tierFilter]);

  useEffect(() => { loadList(1); }, [loadList]);

  useEffect(() => {
    if (searchTimeout.current) clearTimeout(searchTimeout.current);
    if (!searchQuery.trim()) { setSearchResults([]); return; }
    setSearching(true);
    searchTimeout.current = setTimeout(async () => {
      try { const results = await crmService.search(searchQuery); setSearchResults(results); }
      finally { setSearching(false); }
    }, 250);
    return () => { if (searchTimeout.current) clearTimeout(searchTimeout.current); };
  }, [searchQuery]);

  const openCustomer = (id: string) => {
    navigate(`/crm/customers/${id}`);

  };

  const refreshSelected = async () => { if (!selected) return; const detail = await crmService.getDetail(selected.id); setSelected(detail); };

  const TABS: { key: ActiveTab; label: string }[] = [{ key: 'clientes', label: 'Clientes' }, { key: 'fiados', label: 'Créditos / Fiados' }, { key: 'garantias', label: 'Garantías' }];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b sticky top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-1">{TABS.map(t => (<button key={t.key} onClick={() => setActiveTab(t.key)} className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === t.key ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{t.label}</button>))}</div>
            <span className="text-xs text-gray-400">CRM · Fidelización</span>
          </div>
        </div>
      </div>
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {activeTab === 'clientes' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Buscar por nombre, teléfono, cédula o placa..." className="w-full pl-10 pr-4 py-2.5 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white" />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-base">🔍</span>
                {searching && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400">...</span>}
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"
                >
                  + Crear Cliente
                </button>
                <select
                  value={tierFilter}
                  onChange={(e) => setTierFilter(e.target.value)}
                  className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Todos los tiers</option>
                  <option value="BRONZE">Bronce</option>
                  <option value="SILVER">Plata</option>
                  <option value="GOLD">Oro</option>
                </select>
              </div>
            </div>
            {searchQuery && searchResults.length > 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-3 space-y-2">
                <p className="text-xs text-gray-500 font-medium uppercase mb-1">Resultados ({searchResults.length})</p>
                {searchResults.map(c => (<CustomerQuickCard key={c.id} customer={c} onClick={() => { openCustomer(c.id); setSearchQuery(''); setSearchResults([]); }} />))}
              </div>
            )}
            {searchQuery && !searching && searchResults.length === 0 && (
              <div className="bg-white rounded-xl border border-gray-200 p-4 text-center text-sm text-gray-400">Sin resultados para "{searchQuery}"</div>
            )}
            {!searchQuery && (
              <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
                  <p className="text-sm font-medium text-gray-700">{listMeta.total.toLocaleString('es-CO')} clientes</p>
                  <div className="flex gap-2">
                    {listMeta.page > 1 && <button onClick={() => loadList(listMeta.page - 1)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">← Ant</button>}
                    {listMeta.page < listMeta.totalPages && <button onClick={() => loadList(listMeta.page + 1)} className="px-2 py-1 text-xs border rounded hover:bg-gray-50">Sig →</button>}
                  </div>
                </div>
                {loadingList ? <div className="py-12 text-center text-gray-400 text-sm">Cargando...</div> : customerList.length === 0 ? <div className="py-12 text-center text-gray-400 text-sm">Sin clientes registrados</div> : (
                  <div className="divide-y divide-gray-50">{customerList.map(c => (
                    <div key={c.id} onClick={() => openCustomer(c.id)} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer transition-colors">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2"><p className="font-semibold text-gray-900 text-sm truncate">{c.name}</p><TierBadge tier={c.loyaltyTier as LoyaltyTier} /></div>
                        <p className="text-xs text-gray-500 mt-0.5">{c.phone ?? '—'}{c.motorcycles?.[0]?.plate && <span className="ml-2 font-mono text-blue-600">{c.motorcycles[0].plate}</span>}</p>
                      </div>
                      <div className="text-right ml-4 flex-shrink-0"><p className="text-sm font-semibold text-gray-800">${c.totalSpent.toLocaleString('es-CO')}</p><p className="text-xs text-gray-400">{c.purchaseCount} compra{c.purchaseCount !== 1 ? 's' : ''}</p></div>
                    </div>
                  ))}</div>
                )}
              </div>
            )}
          </div>
        )}
        {activeTab === 'fiados' && <CreditsTab onOpenCustomer={openCustomer} />}
        {activeTab === 'garantias' && <WarrantiesTab onOpenCustomer={openCustomer} />}
      </div>
      <CreateCustomerModal
        open={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSuccess={() => loadList(1)}
      />
      {loadingDetail && <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"><div className="bg-white rounded-xl p-8 text-gray-600">Cargando...</div></div>}
      {selected && !loadingDetail && <Customer360Panel customer={selected} onClose={() => setSelected(null)} onRefresh={refreshSelected} />}
    </div>
  );
}

function CreditsTab({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  const [credits, setCredits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    api.get('/treasury/debts', { params: { limit: 100 } }).then((r: any) => setCredits(r?.data?.items ?? [])).catch(() => setCredits([])).finally(() => setLoading(false));
  }, []);

  const filtered = credits.filter(c => !filter || c.status === filter);
  const summary = credits.reduce((acc, c) => ({ total: acc.total + parseFloat(c.totalDebt ?? 0), paid: acc.paid + parseFloat(c.paidAmount ?? 0), pending: acc.pending + parseFloat(c.remainingBalance ?? 0) }), { total: 0, paid: 0, pending: 0 });

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-3">
        {[{ label: 'Total fiado', value: summary.total, color: 'text-gray-900' }, { label: 'Abonado', value: summary.paid, color: 'text-green-600' }, { label: 'Por cobrar', value: summary.pending, color: 'text-red-600' }].map(s => (
          <div key={s.label} className="bg-white rounded-xl border border-gray-200 p-4 text-center"><p className={`text-lg font-bold ${s.color}`}>${s.value.toLocaleString('es-CO')}</p><p className="text-xs text-gray-500 mt-0.5">{s.label}</p></div>
        ))}
      </div>
      <div className="flex gap-2">{['', 'PENDING', 'PARTIALLY_PAID', 'OVERDUE', 'PAID'].map(f => (<button key={f} onClick={() => setFilter(f)} className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${filter === f ? 'bg-blue-600 text-white' : 'bg-white border border-gray-300 text-gray-600 hover:bg-gray-50'}`}>{f === '' ? 'Todos' : f === 'PENDING' ? 'Pendiente' : f === 'PARTIALLY_PAID' ? 'Parcial' : f === 'OVERDUE' ? 'Vencido' : 'Pagado'}</button>))}</div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="py-12 text-center text-gray-400 text-sm">Cargando créditos...</div> : filtered.length === 0 ? <div className="py-12 text-center text-gray-400 text-sm">Sin créditos</div> : (
          <div className="divide-y divide-gray-50">{filtered.map((c: any) => (
            <div key={c.id} onClick={() => c.customerId && onOpenCustomer(c.customerId)} className="flex items-center justify-between px-4 py-3 hover:bg-gray-50 cursor-pointer">
              <div><p className="text-sm font-semibold">{c.customer?.name ?? '—'}</p><p className="text-xs text-gray-400">{c.sale?.saleNumber ?? '—'} · {c.dueDate ? new Date(c.dueDate).toLocaleDateString('es-CO') : 'Sin fecha'}</p></div>
              <div className="text-right"><p className="text-sm font-bold text-red-600">${parseFloat(c.remainingBalance ?? 0).toLocaleString('es-CO')}</p><StatusBadge status={c.status} /></div>
            </div>
          ))}</div>
        )}
      </div>
    </div>
  );
}

function WarrantiesTab({ onOpenCustomer }: { onOpenCustomer: (id: string) => void }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-400">
      <p className="text-4xl mb-3">🛡️</p>
      <p className="text-sm font-medium text-gray-600 mb-1">Garantías del módulo CRM</p>
      <p className="text-xs">Las garantías se crean automáticamente al vender productos con días de garantía configurados. Abre la ficha de un cliente para ver y gestionar sus garantías activas.</p>
    
</div>
  );
}
