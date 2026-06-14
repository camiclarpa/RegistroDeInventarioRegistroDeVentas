import { useState } from 'react';
import { X, User, Phone, Mail, MapPin, FileText, CreditCard, Tag } from 'lucide-react';
import { toast } from 'sonner';
import { crmService } from '@/services/crmService';

interface CreateCustomerModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export default function CreateCustomerModal({ open, onClose, onSuccess }: CreateCustomerModalProps) {
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    identificationNumber: '',
    phone: '',
    email: '',
    address: '',
    birthDate: '',
    notes: '',
    preferences: '',
    creditLimit: '',
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  if (!open) return null;

  const validate = () => {
    const newErrors: Record<string, string> = {};

    if (!form.name.trim()) newErrors.name = 'El nombre es obligatorio';
    if (!form.identificationNumber.trim()) newErrors.identificationNumber = 'La cédula es obligatoria';
    if (!form.phone.trim()) newErrors.phone = 'El teléfono es obligatorio';
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) {
      newErrors.email = 'Email inválido';
    }
    if (form.creditLimit && isNaN(Number(form.creditLimit))) {
      newErrors.creditLimit = 'Debe ser un número válido';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setLoading(true);
    try {
      await crmService.create({
        name: form.name,
        identificationNumber: form.identificationNumber,
        phone: form.phone,
        email: form.email || undefined,
        address: form.address || undefined,
        notes: form.notes || undefined,
        preferences: form.preferences || undefined,
        creditLimit: form.creditLimit ? Number(form.creditLimit) : undefined,
      });

      toast.success('Cliente creado exitosamente');
      onSuccess();
      onClose();
      setForm({
        name: '',
        identificationNumber: '',
        phone: '',
        email: '',
        address: '',
        birthDate: '',
        notes: '',
        preferences: '',
        creditLimit: '',
      });
    } catch (error: any) {
      const message = error?.response?.data?.error || 'Error al crear cliente';
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  const inputClass = (field: string) =>
    `w-full border ${errors[field] ? 'border-red-500' : 'border-gray-300'} rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Crear Nuevo Cliente</h2>
            <p className="text-sm text-gray-500 mt-1">Complete los datos del cliente</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Nombre */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <User size={14} /> Nombre Completo *
            </label>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className={inputClass('name')}
              placeholder="Ej: Juan Pérez"
            />
            {errors.name && <p className="text-xs text-red-600 mt-1">{errors.name}</p>}
          </div>

          {/* Cédula y Teléfono */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <FileText size={14} /> Cédula / ID *
              </label>
              <input
                type="text"
                value={form.identificationNumber}
                onChange={(e) => setForm({ ...form, identificationNumber: e.target.value })}
                className={inputClass('identificationNumber')}
                placeholder="Ej: 1234567890"
              />
              {errors.identificationNumber && <p className="text-xs text-red-600 mt-1">{errors.identificationNumber}</p>}
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Phone size={14} /> Teléfono *
              </label>
              <input
                type="tel"
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                className={inputClass('phone')}
                placeholder="Ej: 3001234567"
              />
              {errors.phone && <p className="text-xs text-red-600 mt-1">{errors.phone}</p>}
            </div>
          </div>

          {/* Email y Fecha de Nacimiento */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
                <Mail size={14} /> Email
              </label>
              <input
                type="email"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                className={inputClass('email')}
                placeholder="Ej: cliente@email.com"
              />
              {errors.email && <p className="text-xs text-red-600 mt-1">{errors.email}</p>}
            </div>
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1.5">Fecha de Nacimiento</label>
              <input
                type="date"
                value={form.birthDate}
                onChange={(e) => setForm({ ...form, birthDate: e.target.value })}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Dirección */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <MapPin size={14} /> Dirección
            </label>
            <input
              type="text"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Calle 123 #45-67, Ciudad"
            />
          </div>

          {/* Límite de Crédito */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <CreditCard size={14} /> Límite de Crédito (COP)
            </label>
            <input
              type="number"
              value={form.creditLimit}
              onChange={(e) => setForm({ ...form, creditLimit: e.target.value })}
              className={inputClass('creditLimit')}
              placeholder="Ej: 5000000"
              min="0"
            />
            {errors.creditLimit && <p className="text-xs text-red-600 mt-1">{errors.creditLimit}</p>}
          </div>

          {/* Preferencias */}
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-1.5">
              <Tag size={14} /> Preferencias
            </label>
            <textarea
              value={form.preferences}
              onChange={(e) => setForm({ ...form, preferences: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Ej: Cliente frecuente, prefiere motos Yamaha"
            />
          </div>

          {/* Notas */}
          <div>
            <label className="text-sm font-medium text-gray-700 mb-1.5">Notas</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={2}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              placeholder="Observaciones adicionales..."
            />
          </div>

          {/* Botones */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg text-sm font-medium disabled:opacity-50 transition-colors"
            >
              {loading ? 'Creando...' : 'Crear Cliente'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
