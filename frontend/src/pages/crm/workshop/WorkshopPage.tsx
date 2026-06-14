import { useState, useEffect, useCallback } from 'react';
import { Plus, Wrench, RefreshCw, CheckSquare, Square } from 'lucide-react';
import { toast } from 'sonner';
import { workshopService } from '@/services/crm/workshopService';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { formatCOP, formatDate, WORKSHOP_SERVICES } from '@/utils/crmFormatters';
import type { WorkshopVisit } from '@/types/crm';
import api from '@/services/api';

function CustomerCombo({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [display, setDisplay] = useState('');
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = { current: null as ReturnType<typeof setTimeout> | null };
  const search = async (q: string) => {
    if (q.length < 2) { setOptions([]); setOpen(false); return; }
    try { const r = await api.get<typeof options>('/crm/customers/search', { params: { q } }); setOptions(Array.isArray(r.data) ? r.data : []); setOpen(true); } catch { /* silent */ }
  };
  return (
    <div className="relative">
      <input type="text" value={display} onChange={e => { setDisplay(e.target.value); if (timerRef.current) clearTimeout(timerRef.current); timerRef.current = setTimeout(() => search(e.target.value), 300); }} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Buscar cliente..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      {open && options.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map(o => (<li key={o.id} onMouseDown={() => { onChange(o.id, o.name); setDisplay(o.name); setOpen(false); }} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm font-medium text-gray-800">{o.name}</li>))}
        </ul>
      )}
    </div>
  );
}

const STATUS_VARIANT: Record<string, 'blue' | 'yellow' | 'green' | 'gray'> = { PENDING: 'blue', IN_PROGRESS: 'yellow', DONE: 'green', CANCELLED: 'gray' };
const STATUS_LABEL: Record<string, string> = { PENDING: 'Pendiente', IN_PROGRESS: 'En proceso', DONE: 'Completado', CANCELLED: 'Cancelado' };
const LIMIT = 12;

export default function WorkshopPage() {
  const [items, setItems] = useState<WorkshopVisit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', kmReal: '', services: [] as string[], technician: '', totalCost: '0', notes: '', nextServiceKm: '' });

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try { const res = await workshopService.list({ page: p, limit: LIMIT }); setItems(res.data); setTotal(res.total); setPage(p); } catch { toast.error('Error al cargar visitas de taller'); } finally { setLoading(false); }
  }, []);

  useEffect(() => { load(1); }, [load]);

  const toggleService = (val: string) => { setForm(f => ({ ...f, services: f.services.includes(val) ? f.services.filter(s => s !== val) : [...f.services, val] })); };

  const handleSave = async () => {
    if (!form.customerId) return toast.error('Selecciona un cliente');
    if (form.services.length === 0) return toast.error('Selecciona al menos un servicio');
    setSaving(true);
    try { await workshopService.create({ customerId: form.customerId, kmReal: form.kmReal ? Number(form.kmReal) : undefined, services: form.services, technician: form.technician || undefined, totalCost: Number(form.totalCost), notes: form.notes || undefined, nextServiceKm: form.nextServiceKm ? Number(form.nextServiceKm) : undefined }); toast.success('Visita registrada'); setShowModal(false); setForm({ customerId: '', kmReal: '', services: [], technician: '', totalCost: '0', notes: '', nextServiceKm: '' }); load(1); } catch { toast.error('Error al registrar visita'); } finally { setSaving(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center gap-3">
        <button onClick={() => load(1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw size={16} /></button>
        <div className="ml-auto"><button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"><Plus size={16} /> Nueva visita</button></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div> : items.length === 0 ? (<div className="flex flex-col items-center justify-center h-64 text-gray-400"><Wrench size={36} className="mb-2 opacity-40" /><p className="text-sm">Sin visitas de taller registradas</p></div>) : (
          <>
            <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide"><th className="px-4 py-3 text-left">Cliente</th><th className="px-4 py-3 text-left">Moto</th><th className="px-4 py-3 text-left">Servicios</th><th className="px-4 py-3 text-left">Estado</th><th className="px-4 py-3 text-right">Costo</th><th className="px-4 py-3 text-left">Próx. km</th><th className="px-4 py-3 text-left">Fecha</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map(v => (<tr key={v.id} className="hover:bg-gray-50 transition-colors"><td className="px-4 py-3 font-medium text-gray-800">{v.customer?.name ?? v.customerId.slice(-8)}</td><td className="px-4 py-3 text-gray-500 text-xs">{v.motorcycle ? `${v.motorcycle.brand} ${v.motorcycle.model} (${v.motorcycle.plate})` : '—'}</td><td className="px-4 py-3"><div className="flex flex-wrap gap-1 max-w-[180px]">{v.services.slice(0, 3).map(s => (<span key={s} className="text-xs bg-indigo-50 text-indigo-700 px-1.5 py-0.5 rounded">{WORKSHOP_SERVICES.find(ws => ws.value === s)?.label ?? s}</span>))}{v.services.length > 3 && (<span className="text-xs text-gray-400">+{v.services.length - 3}</span>)}</div></td><td className="px-4 py-3"><Badge variant={STATUS_VARIANT[v.status] ?? 'gray'}>{STATUS_LABEL[v.status] ?? v.status}</Badge></td><td className="px-4 py-3 text-right font-medium text-gray-800">{formatCOP(v.totalCost)}</td><td className="px-4 py-3 text-gray-500 text-xs">{v.nextServiceKm ? `${v.nextServiceKm.toLocaleString()} km` : '—'}</td><td className="px-4 py-3 text-gray-400 text-xs">{formatDate(v.createdAt)}</td></tr>))}</tbody></table>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={p => load(p)} />
          </>
        )}
      </div>
      <Modal open={showModal} onClose={() => { setShowModal(false); setForm({ customerId: '', kmReal: '', services: [], technician: '', totalCost: '0', notes: '', nextServiceKm: '' }); }} title="Nueva visita de taller" size="lg" loading={saving} footer={<div className="flex justify-end gap-3"><button onClick={() => { setShowModal(false); setForm({ customerId: '', kmReal: '', services: [], technician: '', totalCost: '0', notes: '', nextServiceKm: '' }); }} className="px-4 py-2 text-sm text-gray-600">Cancelar</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">Registrar visita</button></div>}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label><CustomerCombo value={form.customerId} onChange={(id) => setForm(f => ({ ...f, customerId: id }))} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">KM actual</label><input type="number" min={0} value={form.kmReal} onChange={e => setForm(f => ({ ...f, kmReal: e.target.value }))} placeholder="Ej: 15000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-2">Servicios * ({form.services.length} seleccionados)</label><div className="grid grid-cols-2 gap-1.5 max-h-44 overflow-y-auto pr-1">{WORKSHOP_SERVICES.map(s => { const checked = form.services.includes(s.value); return (<button key={s.value} type="button" onClick={() => toggleService(s.value)} className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-left transition-colors border ${checked ? 'bg-indigo-50 border-indigo-300 text-indigo-700' : 'border-gray-200 text-gray-600 hover:bg-gray-50'}`}>{checked ? <CheckSquare size={14} className="text-indigo-600 flex-shrink-0" /> : <Square size={14} className="text-gray-300 flex-shrink-0" />}{s.label}</button>); })}</div></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Técnico</label><input type="text" value={form.technician} onChange={e => setForm(f => ({ ...f, technician: e.target.value }))} placeholder="Nombre del técnico" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Costo total *</label><input type="number" min={0} value={form.totalCost} onChange={e => setForm(f => ({ ...f, totalCost: e.target.value }))} placeholder="0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div></div>
          <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Próximo servicio (km)</label><input type="number" min={0} value={form.nextServiceKm} onChange={e => setForm(f => ({ ...f, nextServiceKm: e.target.value }))} placeholder="Ej: 16000" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label><input type="text" value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Observaciones" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div></div>
        </div>
      </Modal>
    </div>
  );
}
