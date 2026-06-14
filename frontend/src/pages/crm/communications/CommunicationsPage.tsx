import { useState, useEffect, useCallback, useRef } from 'react';
import { MessageSquare, Phone, Mail, UserCheck, MessageCircle, Plus, CheckCheck, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import api from '@/services/api';
import { communicationService } from '@/services/crm/communicationService';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { formatDateTime, formatRelativeTime, CHANNEL_LABELS } from '@/utils/crmFormatters';
import type { Communication } from '@/types/crm';

const CHANNEL_ICON: Record<string, React.ReactNode> = { WHATSAPP: <MessageCircle size={14} />, EMAIL: <Mail size={14} />, CALL: <Phone size={14} />, IN_PERSON: <UserCheck size={14} />, SMS: <MessageSquare size={14} /> };
const CHANNEL_COLOR: Record<string, string> = { WHATSAPP: 'bg-green-100 text-green-700', EMAIL: 'bg-blue-100 text-blue-700', CALL: 'bg-purple-100 text-purple-700', IN_PERSON: 'bg-orange-100 text-orange-700', SMS: 'bg-gray-100 text-gray-600' };
const STATUS_COLOR: Record<string, string> = { SENT: 'bg-blue-100 text-blue-700', DELIVERED: 'bg-indigo-100 text-indigo-700', READ: 'bg-green-100 text-green-700', FAILED: 'bg-red-100 text-red-700', PENDING: 'bg-yellow-100 text-yellow-700' };
const LIMIT = 15;

function CustomerCombo({ value, onChange }: { value: string; onChange: (id: string, name: string) => void }) {
  const [query, setQuery] = useState('');
  const [options, setOptions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [display, setDisplay] = useState('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (!value) { setDisplay(''); return; } }, [value]);
  const search = useCallback(async (q: string) => {
    if (q.length < 2) { setOptions([]); setOpen(false); return; }
    setLoading(true);
    try { const r = await api.get<{ id: string; name: string; phone: string | null }[]>('/crm/customers/search', { params: { q } }); setOptions(Array.isArray(r.data) ? r.data : []); setOpen(true); } catch { /* silent */ } finally { setLoading(false); }
  }, []);
  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value; setQuery(v); setDisplay(v);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => search(v), 300);
  };
  return (
    <div className="relative">
      <input type="text" value={display} onChange={handleInput} onFocus={() => options.length > 0 && setOpen(true)} onBlur={() => setTimeout(() => setOpen(false), 150)} placeholder="Buscar cliente..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
      {loading && <Spinner size="sm" className="absolute right-3 top-2.5" />}
      {open && options.length > 0 && (
        <ul className="absolute z-30 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {options.map(o => (<li key={o.id} onMouseDown={() => { onChange(o.id, o.name); setDisplay(o.name); setOpen(false); }} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"><span className="font-medium text-gray-800">{o.name}</span>{o.phone && <span className="ml-2 text-gray-400 text-xs">{o.phone}</span>}</li>))}
        </ul>
      )}
    </div>
  );
}

export default function CommunicationsPage() {
  const [items, setItems] = useState<Communication[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ customerId: '', customerName: '', channel: 'WHATSAPP', direction: 'OUTBOUND', message: '', status: 'SENT' });
  const [filterChannel, setFilterChannel] = useState('');
  const [filterStatus, setFilterStatus] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try { const res = await communicationService.list({ page: p, limit: LIMIT, channel: filterChannel || undefined, status: filterStatus || undefined }); setItems(res.data); setTotal(res.total); setPage(p); } catch { toast.error('Error al cargar comunicaciones'); } finally { setLoading(false); }
  }, [filterChannel, filterStatus]);

  useEffect(() => { load(1); }, [load]);

  const markRead = async (id: string) => {
    try { await communicationService.markAsRead(id); setItems(prev => prev.map(c => c.id === id ? { ...c, isRead: true, status: 'READ' } : c)); } catch { toast.error('Error al marcar como leído'); }
  };

  const handleSave = async () => {
    if (!form.customerId) return toast.error('Selecciona un cliente');
    if (!form.message.trim()) return toast.error('El mensaje no puede estar vacío');
    setSaving(true);
    try { await communicationService.create({ customerId: form.customerId, channel: form.channel as any, direction: form.direction as any, message: form.message, status: form.status as any }); toast.success('Comunicación registrada'); setShowModal(false); setForm({ customerId: '', customerName: '', channel: 'WHATSAPP', direction: 'OUTBOUND', message: '', status: 'SENT' }); load(1); } catch { toast.error('Error al guardar comunicación'); } finally { setSaving(false); }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterChannel} onChange={e => setFilterChannel(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Todos los canales</option>{Object.entries(CHANNEL_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}</select>
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Todos los estados</option>{['SENT', 'DELIVERED', 'READ', 'FAILED', 'PENDING'].map(s => (<option key={s} value={s}>{s}</option>))}</select>
        <button onClick={() => load(1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100" title="Refrescar"><RefreshCw size={16} /></button>
        <div className="ml-auto"><button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"><Plus size={16} /> Nueva comunicación</button></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div> : items.length === 0 ? (<div className="flex flex-col items-center justify-center h-64 text-gray-400"><MessageSquare size={36} className="mb-2 opacity-40" /><p className="text-sm">Sin comunicaciones registradas</p></div>) : (
          <>
            <div className="divide-y divide-gray-100">
              {items.map(comm => (
                <div key={comm.id} className="flex gap-4 px-5 py-4 hover:bg-gray-50 transition-colors">
                  <div className={`mt-1 flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${CHANNEL_COLOR[comm.channel] ?? 'bg-gray-100 text-gray-600'}`}>{CHANNEL_ICON[comm.channel] ?? <MessageSquare size={14} />}</div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <span className="text-sm font-medium text-gray-800 truncate">{comm.customer?.name ?? comm.customerId}</span>
                      <span className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${CHANNEL_COLOR[comm.channel] ?? 'bg-gray-100'}`}>{CHANNEL_LABELS[comm.channel] ?? comm.channel}</span>
                      <Badge variant={comm.direction === 'INBOUND' ? 'blue' : 'purple'}>{comm.direction === 'INBOUND' ? 'Entrante' : 'Saliente'}</Badge>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[comm.status] ?? 'bg-gray-100 text-gray-600'}`}>{comm.status}</span>
                      {comm.isRead && (<span title="Leído"><CheckCheck size={14} className="text-green-500" /></span>)}
                    </div>
                    <p className="text-sm text-gray-600 line-clamp-2">{comm.message}</p>
                    <p className="text-xs text-gray-400 mt-1" title={formatDateTime(comm.createdAt)}>{formatRelativeTime(comm.createdAt)}</p>
                  </div>
                  {!comm.isRead && comm.status !== 'READ' && (<button onClick={() => markRead(comm.id)} className="flex-shrink-0 self-start mt-1 text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><CheckCheck size={13} /> Leído</button>)}
                </div>
              ))}
            </div>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={p => load(p)} />
          </>
        )}
      </div>
      <Modal open={showModal} onClose={() => setShowModal(false)} title="Nueva comunicación" loading={saving} footer={<div className="flex justify-end gap-3"><button onClick={() => setShowModal(false)} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Cancelar</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">Guardar</button></div>}>
        <div className="space-y-4">
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label><CustomerCombo value={form.customerId} onChange={(id, name) => setForm(f => ({ ...f, customerId: id, customerName: name }))} /></div>
          <div className="grid grid-cols-2 gap-3"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Canal</label><select value={form.channel} onChange={e => setForm(f => ({ ...f, channel: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">{Object.entries(CHANNEL_LABELS).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}</select></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Dirección</label><select value={form.direction} onChange={e => setForm(f => ({ ...f, direction: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="OUTBOUND">Saliente</option><option value="INBOUND">Entrante</option></select></div></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Estado</label><select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">{['SENT', 'DELIVERED', 'READ', 'PENDING'].map(s => (<option key={s} value={s}>{s}</option>))}</select></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Mensaje *</label><textarea value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} rows={4} placeholder="Escribe el mensaje o resumen de la comunicación..." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
        </div>
      </Modal>
    </div>
  );
}
