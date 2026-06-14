import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft, User, Bike, ShoppingBag, Bell, CreditCard,
  Shield, MessageSquare, Plus, Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { crmService, chatService } from '@/services/crmService';
import type { ChatMessage, CrmCustomer, Motorcycle, Reminder } from '@/services/crmService';
import { Badge } from '@/components/ui/Badge';
import { Spinner } from '@/components/ui/Spinner';
import { Modal } from '@/components/ui/Modal';
import { formatCOP, formatDate, formatDateTime, formatKm, REMINDER_TYPES } from '@/utils/crmFormatters';

type Tab = 'info' | 'motorcycles' | 'sales' | 'reminders' | 'credits' | 'warranties' | 'chat';

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [customer, setCustomer] = useState<CrmCustomer | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('info');
  const [showReminderModal, setShowReminderModal] = useState(false);
  const [showAddMotoModal, setShowAddMotoModal] = useState(false);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [reminderForm, setReminderForm] = useState({
    type: 'FOLLOW_UP',
    message: '',
    dueDate: '',
  });
  const [motoForm, setMotoForm] = useState({
    plate: '',
    brand: '',
    model: '',
    year: '',
    lastKm: '',
  });

  useEffect(() => {
    if (id) loadCustomer();
  }, [id]);

  useEffect(() => {
    if (activeTab === 'chat' && id) loadChatMessages();
  }, [activeTab, id]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const loadCustomer = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await crmService.getDetail(id);
      setCustomer(data);
    } catch {
      toast.error('Error al cargar cliente');
      navigate('/crm');
    } finally {
      setLoading(false);
    }
  };

  const loadChatMessages = async () => {
    if (!id) return;
    setChatLoading(true);
    try {
      const res = await chatService.getMessages(id);
      setChatMessages(res.data.reverse());
    } catch {
      toast.error('Error al cargar mensajes');
    } finally {
      setChatLoading(false);
    }
  };

  const handleAddReminder = async () => {
    if (!id) return;
    if (!reminderForm.message || !reminderForm.dueDate) {
      return toast.error('Completa todos los campos');
    }
    try {
      await crmService.addReminder(id, {
        type: reminderForm.type,
        message: reminderForm.message,
        dueDate: new Date(reminderForm.dueDate).toISOString(),
      });
      toast.success('Recordatorio creado');
      setShowReminderModal(false);
      setReminderForm({ type: 'FOLLOW_UP', message: '', dueDate: '' });
      loadCustomer();
    } catch {
      toast.error('Error al crear recordatorio');
    }
  };

  const handleAddMoto = async () => {
    if (!id) return;
    if (!motoForm.plate || !motoForm.brand || !motoForm.model) {
      return toast.error('Completa los campos obligatorios');
    }
    try {
      await crmService.addMotorcycle(id, {
        plate: motoForm.plate.toUpperCase(),
        brand: motoForm.brand,
        model: motoForm.model,
        year: motoForm.year ? parseInt(motoForm.year) : undefined,
        lastKm: motoForm.lastKm ? parseInt(motoForm.lastKm) : undefined,
      });
      toast.success('Moto registrada');
      setShowAddMotoModal(false);
      setMotoForm({ plate: '', brand: '', model: '', year: '', lastKm: '' });
      loadCustomer();
    } catch {
      toast.error('Error al registrar moto');
    }
  };

  const handleSendMessage = async () => {
    if (!id || !newMessage.trim() || sending) return;
    setSending(true);
    try {
      const msg = await chatService.sendMessage(id, newMessage);
      setChatMessages(prev => [...prev, msg]);
      setNewMessage('');
    } catch {
      toast.error('Error al enviar mensaje');
    } finally {
      setSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!customer) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Cliente no encontrado</p>
        <button onClick={() => navigate('/crm')} className="text-indigo-600 hover:text-indigo-800">
          Volver al CRM
        </button>
      </div>
    );
  }

  const tabs = [
    { id: 'info' as Tab, label: 'Información', icon: <User size={16} /> },
    { id: 'motorcycles' as Tab, label: 'Motos', icon: <Bike size={16} />, count: customer.motorcycles?.length || 0 },
    { id: 'sales' as Tab, label: 'Compras', icon: <ShoppingBag size={16} />, count: customer.recentSales?.length || 0 },
    { id: 'reminders' as Tab, label: 'Recordatorios', icon: <Bell size={16} />, count: customer.reminders?.filter(r => !r.isSent).length || 0 },
    { id: 'credits' as Tab, label: 'Créditos', icon: <CreditCard size={16} />, count: customer.activeCredits?.length || 0 },
    { id: 'warranties' as Tab, label: 'Garantías', icon: <Shield size={16} />, count: customer.activeWarranties?.length || 0 },
    { id: 'chat' as Tab, label: 'Chat', icon: <MessageSquare size={16} /> },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <button onClick={() => navigate('/crm')} className="p-2 rounded-lg text-gray-500 hover:bg-gray-100">
            <ArrowLeft size={20} />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
              <Badge variant={customer.loyaltyTier === 'GOLD' ? 'yellow' : customer.loyaltyTier === 'SILVER' ? 'gray' : 'orange'}>
                {customer.loyaltyTier}
              </Badge>
            </div>
            <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
              {customer.phone && <span>📱 {customer.phone}</span>}
              {customer.email && <span>✉️ {customer.email}</span>}
              {customer.identificationNumber && <span>🆔 {customer.identificationNumber}</span>}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase">Total Gastado</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{formatCOP(customer.totalSpent)}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase">Puntos</p>
          <p className="text-2xl font-bold text-indigo-600 mt-1">{customer.loyaltyPoints}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase">Compras</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{customer.purchaseCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 uppercase">Deuda</p>
          <p className="text-2xl font-bold text-red-600 mt-1">{formatCOP(customer.totalPendingDebt || 0)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="border-b border-gray-200 overflow-x-auto">
          <div className="flex min-w-max">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
              >
                {tab.icon}
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="px-2 py-0.5 text-xs bg-gray-100 rounded-full">{tab.count}</span>
                )}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* Tab: Información */}
          {activeTab === 'info' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-semibold text-gray-700 mb-3">Información Personal</h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-xs text-gray-500">Dirección</p>
                    <p className="text-sm text-gray-900">{customer.address || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Preferencias</p>
                    <p className="text-sm text-gray-900">{customer.preferences || '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Última Compra</p>
                    <p className="text-sm text-gray-900">{formatDate(customer.lastPurchaseAt)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500">Límite de Crédito</p>
                    <p className="text-sm text-gray-900">{customer.creditLimit ? formatCOP(customer.creditLimit) : '—'}</p>
                  </div>
                </div>
              </div>
              {customer.notes && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Notas</h3>
                  <p className="text-sm text-gray-900 bg-gray-50 p-4 rounded-lg">{customer.notes}</p>
                </div>
              )}
              {customer.tags && customer.tags.length > 0 && (
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Etiquetas</h3>
                  <div className="flex flex-wrap gap-2">
                    {customer.tags.map(tag => (
                      <span key={tag} className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab: Motos */}
          {activeTab === 'motorcycles' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowAddMotoModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  <Plus size={16} /> Agregar Moto
                </button>
              </div>
              {!customer.motorcycles || customer.motorcycles.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bike size={48} className="mx-auto mb-3 opacity-40" />
                  <p>No hay motos registradas</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {customer.motorcycles.map((moto: Motorcycle) => (
                    <div key={moto.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-mono text-lg font-bold text-gray-900">{moto.plate}</p>
                          <p className="text-sm text-gray-600">{moto.brand} {moto.model}</p>
                        </div>
                        <Badge variant="blue">{moto.year || '—'}</Badge>
                      </div>
                      <div className="mt-3 pt-3 border-t border-gray-100">
                        <p className="text-xs text-gray-500">Último kilometraje</p>
                        <p className="text-sm font-medium text-gray-900">{formatKm(moto.lastKm)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Compras */}
          {activeTab === 'sales' && (
            <div>
              {!customer.recentSales || customer.recentSales.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <ShoppingBag size={48} className="mx-auto mb-3 opacity-40" />
                  <p>No hay compras registradas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customer.recentSales.map((sale: any) => (
                    <div key={sale.id} className="border border-gray-200 rounded-lg p-4 hover:border-indigo-300 transition-colors">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{sale.saleNumber}</p>
                          <p className="text-sm text-gray-500">{formatDateTime(sale.createdAt)}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-gray-900">{formatCOP(sale.totalAmount)}</p>
                          <p className="text-xs text-gray-500">{sale.paymentMethod}</p>
                        </div>
                      </div>
                      {sale.motorcycle && (
                        <div className="mt-2 pt-2 border-t border-gray-100">
                          <p className="text-xs text-gray-500">
                            Moto: {sale.motorcycle.brand} {sale.motorcycle.model} ({sale.motorcycle.plate})
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Recordatorios */}
          {activeTab === 'reminders' && (
            <div className="space-y-4">
              <div className="flex justify-end">
                <button
                  onClick={() => setShowReminderModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium"
                >
                  <Plus size={16} /> Nuevo Recordatorio
                </button>
              </div>
              {!customer.reminders || customer.reminders.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Bell size={48} className="mx-auto mb-3 opacity-40" />
                  <p>No hay recordatorios</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customer.reminders.map((reminder: Reminder) => (
                    <div key={reminder.id} className={`border rounded-lg p-4 ${reminder.isSent ? 'border-gray-200 bg-gray-50' : 'border-yellow-300 bg-yellow-50'}`}>
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant={reminder.isSent ? 'gray' : 'yellow'}>
                              {REMINDER_TYPES.find(t => t.value === reminder.type)?.label || reminder.type}
                            </Badge>
                            {reminder.isSent && <span className="text-xs text-gray-500">✓ Enviado</span>}
                          </div>
                          <p className="text-sm text-gray-900 mt-2">{reminder.message}</p>
                          <p className="text-xs text-gray-500 mt-2">Vence: {formatDateTime(reminder.dueDate)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Créditos */}
          {activeTab === 'credits' && (
            <div>
              {!customer.activeCredits || customer.activeCredits.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <CreditCard size={48} className="mx-auto mb-3 opacity-40" />
                  <p>No hay créditos activos</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customer.activeCredits.map((credit: any) => (
                    <div key={credit.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{credit.sale?.saleNumber || credit.saleId}</p>
                          <p className="text-sm text-gray-500">{formatDate(credit.createdAt)}</p>
                        </div>
                        <Badge variant={credit.status === 'PAID' ? 'green' : credit.status === 'OVERDUE' ? 'red' : 'yellow'}>
                          {credit.status}
                        </Badge>
                      </div>
                      <div className="mt-3 grid grid-cols-3 gap-4 text-sm">
                        <div>
                          <p className="text-xs text-gray-500">Deuda Total</p>
                          <p className="font-medium text-gray-900">{formatCOP(credit.totalDebt)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Pagado</p>
                          <p className="font-medium text-green-600">{formatCOP(credit.paidAmount)}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500">Restante</p>
                          <p className="font-medium text-red-600">{formatCOP(credit.remainingBalance)}</p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Garantías */}
          {activeTab === 'warranties' && (
            <div>
              {!customer.activeWarranties || customer.activeWarranties.length === 0 ? (
                <div className="text-center py-12 text-gray-400">
                  <Shield size={48} className="mx-auto mb-3 opacity-40" />
                  <p>No hay garantías activas</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {customer.activeWarranties.map((warranty: any) => (
                    <div key={warranty.id} className="border border-gray-200 rounded-lg p-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-gray-900">{warranty.productName}</p>
                          <p className="text-sm text-gray-500">{warranty.days} días de garantía</p>
                        </div>
                        <Badge variant={warranty.status === 'ACTIVE' ? 'green' : warranty.status === 'EXPIRED' ? 'red' : 'yellow'}>
                          {warranty.status}
                        </Badge>
                      </div>
                      <div className="mt-2">
                        <p className="text-xs text-gray-500">Vence: {formatDate(warranty.expiresAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Tab: Chat */}
          {activeTab === 'chat' && (
            <div className="flex flex-col h-[500px]">
              <div className="flex-1 overflow-y-auto space-y-3 mb-4 border border-gray-100 rounded-lg p-4 bg-gray-50">
                {chatLoading ? (
                  <div className="flex items-center justify-center h-full">
                    <Spinner />
                  </div>
                ) : chatMessages.length === 0 ? (
                  <div className="text-center py-12 text-gray-400">
                    <MessageSquare size={48} className="mx-auto mb-3 opacity-40" />
                    <p>No hay mensajes aún</p>
                    <p className="text-sm mt-1">Inicia una conversación con el cliente</p>
                  </div>
                ) : (
                  chatMessages.map(msg => (
                    <div key={msg.id} className={`flex ${msg.direction === 'OUTBOUND' ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-[70%] rounded-lg px-4 py-2 ${
                        msg.direction === 'OUTBOUND'
                          ? 'bg-indigo-600 text-white'
                          : 'bg-white border border-gray-200 text-gray-900'
                      }`}>
                        <p className="text-sm">{msg.message}</p>
                        <p className={`text-xs mt-1 ${msg.direction === 'OUTBOUND' ? 'text-indigo-200' : 'text-gray-500'}`}>
                          {formatDateTime(msg.created_at)}
                        </p>
                      </div>
                    </div>
                  ))
                )}
                <div ref={chatEndRef} />
              </div>

              <div className="flex gap-2">
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
                  placeholder="Escribe un mensaje..."
                  disabled={sending}
                  className="flex-1 border border-gray-300 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:bg-gray-100"
                />
                <button
                  onClick={handleSendMessage}
                  disabled={!newMessage.trim() || sending}
                  className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-300 text-white rounded-lg text-sm font-medium flex items-center gap-2"
                >
                  <Send size={16} />
                  {sending ? 'Enviando...' : 'Enviar'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Modal: Nuevo Recordatorio */}
      <Modal open={showReminderModal} onClose={() => setShowReminderModal(false)} title="Nuevo Recordatorio" size="md">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Tipo *</label>
            <select
              value={reminderForm.type}
              onChange={(e) => setReminderForm({ ...reminderForm, type: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {REMINDER_TYPES.map(type => (
                <option key={type.value} value={type.value}>{type.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Mensaje *</label>
            <textarea
              value={reminderForm.message}
              onChange={(e) => setReminderForm({ ...reminderForm, message: e.target.value })}
              rows={4}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Escribe el mensaje del recordatorio..."
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Fecha de vencimiento *</label>
            <input
              type="datetime-local"
              value={reminderForm.dueDate}
              onChange={(e) => setReminderForm({ ...reminderForm, dueDate: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowReminderModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
            <button onClick={handleAddReminder} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
              Crear Recordatorio
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Agregar Moto */}
      <Modal open={showAddMotoModal} onClose={() => setShowAddMotoModal(false)} title="Agregar Moto" size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Placa *</label>
              <input
                type="text"
                value={motoForm.plate}
                onChange={(e) => setMotoForm({ ...motoForm, plate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="ABC123"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Año</label>
              <input
                type="number"
                value={motoForm.year}
                onChange={(e) => setMotoForm({ ...motoForm, year: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="2020"
              />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Marca *</label>
              <input
                type="text"
                value={motoForm.brand}
                onChange={(e) => setMotoForm({ ...motoForm, brand: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="Yamaha"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Modelo *</label>
              <input
                type="text"
                value={motoForm.model}
                onChange={(e) => setMotoForm({ ...motoForm, model: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                placeholder="MT-07"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Kilometraje actual</label>
            <input
              type="number"
              value={motoForm.lastKm}
              onChange={(e) => setMotoForm({ ...motoForm, lastKm: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="15000"
            />
          </div>
          <div className="flex justify-end gap-3 pt-4">
            <button onClick={() => setShowAddMotoModal(false)} className="px-4 py-2 text-sm text-gray-600">Cancelar</button>
            <button onClick={handleAddMoto} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium">
              Registrar Moto
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
