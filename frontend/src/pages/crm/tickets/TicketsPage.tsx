import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, RefreshCw, Ticket as TicketIcon, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { ticketService } from '@/services/crm/ticketService';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { formatDateTime, PRIORITY_COLORS, STATUS_COLORS } from '@/utils/crmFormatters';
import type { Ticket } from '@/types/crm';
import api from '@/services/api';

function CustomerCombo({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [display, setDisplay] = useState('');
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [open, setOpen] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const search = async (q: string) => {
    if (q.length < 2) { setOptions([]); setOpen(false); return; }
    try { const r = await api.get<{ id: string; name: string }[]>('/crm/customers/search', { params: { q } }); setOptions(Array.isArray(r.data) ? r.data : []); setOpen(true); } catch { /* silent */ }
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

const PRIORITY_VARIANT: Record<string, 'gray' | 'blue' | 'orange' | 'red'> = { LOW: 'gray', MEDIUM: 'blue', HIGH: 'orange', URGENT: 'red' };
const STATUS_LABEL: Record<string, string> = { OPEN: 'Abierto', IN_PROGRESS: 'En progreso', RESOLVED: 'Resuelto', CLOSED: 'Cerrado' };
const NEXT_STATUS: Record<string, string> = { OPEN: 'IN_PROGRESS', IN_PROGRESS: 'RESOLVED', RESOLVED: 'CLOSED' };
const NEXT_STATUS_LABEL: Record<string, string> = { OPEN: 'Iniciar', IN_PROGRESS: 'Resolver', RESOLVED: 'Cerrar' };
const LIMIT = 12;

export default function TicketsPage() {
  const [items, setItems] = useState<Ticket[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', subject: '', description: '', priority: 'MEDIUM' });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterPriority, setFilterPriority] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try { const res = await ticketService.list({ page: p, limit: LIMIT, status: filterStatus || undefined, priority: filterPriority || undefined }); setItems(res.data); setTotal(res.total); setPage(p); } catch { toast.error('Error al cargar tickets'); } finally { setLoading(false); }
  }, [filterStatus, filterPriority]);

  useEffect(() => { load(1); }, [load]);

  const advance = async (ticket: Ticket) => {
    const next = NEXT_STATUS[ticket.status]; if (!next) return;
    try { const updated = await ticketService.update(ticket.id, { status: next as any }); setItems(prev => prev.map(t => t.id === ticket.id ? updated : t)); toast.success(`Ticket → ${STATUS_LABEL[next]}`); } catch { toast.error('Error al actualizar ticket'); }
  };

  const handleSave = async () => {
    if (!form.customerId) return toast.error('Selecciona un cliente');
    if (!form.subject.trim()) return toast.error('El asunto es requerido');
    const description = form.description.trim().length >= 5 ? form.description.trim() : form.description.trim() || 'Sin descripción adicional';
    setSaving(true);
    try { await ticketService.create({ customerId: form.customerId, subject: form.subject, description, priority: form.priority as any }); toast.success('Ticket creado'); setShowModal(false); setForm({ customerId: '', subject: '', description: '', priority: 'MEDIUM' }); load(1); } catch { toast.error('Error al crear ticket'); } finally { setSaving(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Todos los estados</option>{Object.entries(STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}</select>
        <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Todas las prioridades</option>{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (<option key={p} value={p}>{p}</option>))}</select>
        <button onClick={() => load(1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw size={16} /></button>
        <div className="ml-auto"><button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"><Plus size={16} /> Nuevo ticket</button></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div> : items.length === 0 ? (<div className="flex flex-col items-center justify-center h-64 text-gray-400"><TicketIcon size={36} className="mb-2 opacity-40" /><p className="text-sm">Sin tickets registrados</p></div>) : (
          <>
            <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide"><th className="px-4 py-3 text-left">Asunto</th><th className="px-4 py-3 text-left">Cliente</th><th className="px-4 py-3 text-left">Prioridad</th><th className="px-4 py-3 text-left">Estado</th><th className="px-4 py-3 text-left">Creado</th><th className="px-4 py-3 text-right">Acción</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map(t => (<tr key={t.id} className="hover:bg-gray-50 transition-colors"><td className="px-4 py-3"><p className="font-medium text-gray-800 truncate max-w-[200px]">{t.subject}</p><p className="text-xs text-gray-400 truncate max-w-[200px]">{t.description}</p></td><td className="px-4 py-3 text-gray-600">{t.customer?.name ?? t.customerId.slice(-8)}</td><td className="px-4 py-3"><Badge variant={PRIORITY_VARIANT[t.priority] ?? 'gray'}>{t.priority}</Badge></td><td className="px-4 py-3"><span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${STATUS_COLORS[t.status] ?? 'bg-gray-100 text-gray-600'}`}>{STATUS_LABEL[t.status] ?? t.status}</span></td><td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">{formatDateTime(t.createdAt)}</td><td className="px-4 py-3 text-right">{NEXT_STATUS[t.status] && (<button onClick={() => advance(t)} className="text-xs text-indigo-600 hover:text-indigo-800 font-medium">{NEXT_STATUS_LABEL[t.status]}</button>)}</td></tr>))}</tbody></table>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={p => load(p)} />
          </>
        )}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nuevo ticket" loading={saving} footer={<div className="flex justify-end gap-3"><button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">Crear ticket</button></div>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label><CustomerCombo value={form.customerId} onChange={(id) => setForm(f => ({ ...f, customerId: id }))} /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Asunto *</label><input type="text" value={form.subject} onChange={e => setForm(f => ({ ...f, subject: e.target.value }))} placeholder="Título del ticket" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Prioridad</label><select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">{['LOW', 'MEDIUM', 'HIGH', 'URGENT'].map(p => (<option key={p} value={p}>{p}</option>))}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Descripción</label><textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={4} placeholder="Describe el problema o solicitud..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
        </div>
      </Modal>
    </div>
  );
}
