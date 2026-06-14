import { useState, useEffect, useCallback } from 'react';
import { Plus, FileText, Download, MessageCircle, Trash2, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { quoteService } from '@/services/crm/quoteService';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Pagination } from '@/components/ui/Pagination';
import { formatCOP, formatDate, QUOTE_STATUS_COLORS } from '@/utils/crmFormatters';
import type { Quote } from '@/types/crm';
import api from '@/services/api';

function CustomerCombo({ value, onChange }: { value: string; onChange: (id: string, name: string, phone: string | null) => void }) {
  const [display, setDisplay] = useState('');
  const [options, setOptions] = useState<{ id: string; name: string; phone: string | null }[]>([]);
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
          {options.map(o => (<li key={o.id} onMouseDown={() => { onChange(o.id, o.name, o.phone); setDisplay(o.name); setOpen(false); }} className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm"><span className="font-medium text-gray-800">{o.name}</span>{o.phone && <span className="ml-2 text-gray-400 text-xs">{o.phone}</span>}</li>))}
        </ul>
      )}
    </div>
  );
}

interface LineItem { description: string; qty: number; unitPrice: number; discount: number; }
const EMPTY_ITEM: LineItem = { description: '', qty: 1, unitPrice: 0, discount: 0 };
const LIMIT = 12;
const STATUS_LABEL: Record<string, string> = { DRAFT: 'Borrador', SENT: 'Enviado', ACCEPTED: 'Aceptado', REJECTED: 'Rechazado', EXPIRED: 'Expirado' };

function LineItemRow({ item, index, onChange, onRemove }: { item: LineItem; index: number; onChange: (i: number, field: keyof LineItem, val: string | number) => void; onRemove: (i: number) => void; }) {
  const subtotal = item.qty * item.unitPrice * (1 - item.discount / 100);
  return (
    <div className="grid grid-cols-12 gap-2 items-center">
      <input className="col-span-4 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Descripción" value={item.description} onChange={e => onChange(index, 'description', e.target.value)} />
      <input type="number" min={1} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Cant." value={item.qty} onChange={e => onChange(index, 'qty', Number(e.target.value))} />
      <input type="number" min={0} className="col-span-3 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Precio" value={item.unitPrice} onChange={e => onChange(index, 'unitPrice', Number(e.target.value))} />
      <input type="number" min={0} max={100} className="col-span-2 border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500" placeholder="Desc%" value={item.discount} onChange={e => onChange(index, 'discount', Number(e.target.value))} />
      <button onClick={() => onRemove(index)} className="text-red-400 hover:text-red-600"><Trash2 size={14} /></button>
      <div className="col-span-11 text-right text-xs text-gray-500 pr-6">{formatCOP(subtotal)}</div>
    </div>
  );
}

export default function QuotesPage() {
  const [items, setItems] = useState<Quote[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [customerId, setCustomerId] = useState('');
  const [customerPhone, setCustomerPhone] = useState<string | null>(null);
  const [lines, setLines] = useState<LineItem[]>([{ ...EMPTY_ITEM }]);
  const [globalDiscount, setGlobalDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [expiresAt, setExpiresAt] = useState('');

  const load = useCallback(async (p = 1) => {
    setLoading(true);
    try { const res = await quoteService.list({ page: p, limit: LIMIT, status: filterStatus || undefined }); setItems(res.data); setTotal(res.total); setPage(p); } catch { toast.error('Error al cargar cotizaciones'); } finally { setLoading(false); }
  }, [filterStatus]);

  useEffect(() => { load(1); }, [load]);

  const updateLine = (i: number, field: keyof LineItem, val: string | number) => setLines(prev => prev.map((l, idx) => idx === i ? { ...l, [field]: val } : l));
  const removeLine = (i: number) => { if (lines.length === 1) return; setLines(prev => prev.filter((_, idx) => idx !== i)); };
  const subtotal = lines.reduce((s, l) => s + l.qty * l.unitPrice * (1 - l.discount / 100), 0);
  const totalCalc = subtotal * (1 - globalDiscount / 100);
  const resetForm = () => { setCustomerId(''); setCustomerPhone(null); setLines([{ ...EMPTY_ITEM }]); setGlobalDiscount(0); setNotes(''); setExpiresAt(''); };

  const handleSave = async () => {
    if (!customerId) return toast.error('Selecciona un cliente');
    if (lines.some(l => !l.description.trim())) return toast.error('Completa todas las descripciones');
    setSaving(true);
    try { await quoteService.create({ customerId, items: lines.map(l => ({ description: l.description, qty: l.qty, unitPrice: l.unitPrice, discount: l.discount })), discount: globalDiscount, notes: notes || undefined, expiresAt: expiresAt || undefined }); toast.success('Cotización creada'); setShowModal(false); resetForm(); load(1); } catch { toast.error('Error al crear cotización'); } finally { setSaving(false); }
  };

  const updateStatus = async (id: string, status: string) => {
    try { const updated = await quoteService.updateStatus(id, status); setItems(prev => prev.map(q => q.id === id ? updated : q)); toast.success(`Estado → ${STATUS_LABEL[status]}`); } catch { toast.error('Error al actualizar estado'); }
  };

  const sendWhatsApp = async (quote: Quote) => {
    const phone = quote.customer?.phone ?? customerPhone ?? '';
    if (!phone) return toast.error('El cliente no tiene teléfono registrado');
    try { const link = await quoteService.getWhatsAppLink(quote.id, phone); window.open(link, '_blank'); await quoteService.recordDelivery(quote.id, 'WHATSAPP', link); } catch { toast.error('Error al generar enlace WhatsApp'); }
  };

  const totalPages = Math.max(1, Math.ceil(total / LIMIT));

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"><option value="">Todos los estados</option>{Object.entries(STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}</select>
        <button onClick={() => load(1)} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100"><RefreshCw size={16} /></button>
        <div className="ml-auto"><button onClick={() => setShowModal(true)} className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium transition-colors"><Plus size={16} /> Nueva cotización</button></div>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? <div className="flex items-center justify-center h-64"><Spinner size="lg" /></div> : items.length === 0 ? (<div className="flex flex-col items-center justify-center h-64 text-gray-400"><FileText size={36} className="mb-2 opacity-40" /><p className="text-sm">Sin cotizaciones registradas</p></div>) : (
          <>
            <table className="w-full text-sm"><thead><tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide"><th className="px-4 py-3 text-left">#</th><th className="px-4 py-3 text-left">Cliente</th><th className="px-4 py-3 text-left">Estado</th><th className="px-4 py-3 text-right">Total</th><th className="px-4 py-3 text-left">Vence</th><th className="px-4 py-3 text-right">Acciones</th></tr></thead><tbody className="divide-y divide-gray-100">{items.map(q => (<tr key={q.id} className="hover:bg-gray-50 transition-colors"><td className="px-4 py-3 text-gray-400 font-mono text-xs">{q.id.slice(-8)}</td><td className="px-4 py-3 text-gray-800">{q.customer?.name ?? q.customerId.slice(-8)}</td><td className="px-4 py-3"><select value={q.status} onChange={e => updateStatus(q.id, e.target.value)} className={`text-xs px-2 py-1 rounded-full border-0 font-medium cursor-pointer ${QUOTE_STATUS_COLORS[q.status] ?? 'bg-gray-100'}`}>{Object.entries(STATUS_LABEL).map(([k, v]) => (<option key={k} value={k}>{v}</option>))}</select></td><td className="px-4 py-3 text-right font-medium text-gray-800">{formatCOP(q.total)}</td><td className="px-4 py-3 text-gray-400 text-xs">{formatDate(q.expiresAt)}</td><td className="px-4 py-3"><div className="flex items-center justify-end gap-2"><button onClick={() => quoteService.downloadPdf(q.id)} className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100" title="Descargar PDF"><Download size={14} /></button><button onClick={() => sendWhatsApp(q)} className="p-1.5 rounded-lg text-gray-400 hover:text-green-600 hover:bg-green-50" title="Enviar por WhatsApp"><MessageCircle size={14} /></button></div></td></tr>))}</tbody></table>
            <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={p => load(p)} />
          </>
        )}
      </div>
      <Modal open={showModal} onClose={() => { setShowModal(false); resetForm(); }} title="Nueva cotización" size="lg" loading={saving} footer={<div className="flex items-center justify-between"><div className="text-sm text-gray-500">Total: <span className="font-bold text-gray-800 text-base">{formatCOP(totalCalc)}</span></div><div className="flex gap-3"><button onClick={() => { setShowModal(false); resetForm(); }} className="px-4 py-2 text-sm text-gray-600">Cancelar</button><button onClick={handleSave} disabled={saving} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors">Crear cotización</button></div></div>}>
        <div className="space-y-5">
          <div className="grid grid-cols-2 gap-4"><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Cliente *</label><CustomerCombo value={customerId} onChange={(id, _name, phone) => { setCustomerId(id); setCustomerPhone(phone); }} /></div><div><label className="block text-sm font-medium text-gray-700 mb-1.5">Vence</label><input type="date" value={expiresAt} onChange={e => setExpiresAt(e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" /></div></div>
          <div><div className="flex items-center justify-between mb-2"><label className="text-sm font-medium text-gray-700">Ítems *</label><button onClick={() => setLines(prev => [...prev, { ...EMPTY_ITEM }])} className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center gap-1"><Plus size={12} /> Agregar ítem</button></div><div className="space-y-2"><div className="grid grid-cols-12 gap-2 text-xs text-gray-500 px-0.5"><span className="col-span-4">Descripción</span><span className="col-span-2">Cant.</span><span className="col-span-3">Precio</span><span className="col-span-2">Desc%</span></div>{lines.map((line, i) => (<LineItemRow key={i} item={line} index={i} onChange={updateLine} onRemove={removeLine} />))}</div></div>
          <div className="flex items-center gap-4 pt-2 border-t border-gray-100"><div className="flex items-center gap-2 text-sm"><label className="text-gray-600 font-medium">Descuento global:</label><input type="number" min={0} max={100} value={globalDiscount} onChange={e => setGlobalDiscount(Number(e.target.value))} className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-1 focus:ring-indigo-500" /><span className="text-gray-400">%</span></div><div className="ml-auto text-sm text-gray-500">Subtotal: <span className="font-medium text-gray-700">{formatCOP(subtotal)}</span></div></div>
          <div><label className="block text-sm font-medium text-gray-700 mb-1.5">Notas</label><textarea value={notes} onChange={e => setNotes(e.target.value)} rows={2} placeholder="Observaciones, condiciones, etc." className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" /></div>
        </div>
      </Modal>
    </div>
  );
}
