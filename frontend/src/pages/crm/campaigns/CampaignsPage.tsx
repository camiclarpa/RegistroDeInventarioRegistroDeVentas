import { useState } from 'react';
import { Megaphone, Send, CheckCircle2, XCircle, SkipForward } from 'lucide-react';
import { toast } from 'sonner';
import { campaignService } from '@/services/crm/campaignService';
import { Spinner } from '@/components/ui/Spinner';
import { getRfmBadge, RFM_LABELS, CHANNEL_LABELS } from '@/utils/crmFormatters';
import type { CampaignResult } from '@/services/crm/campaignService';

const TEMPLATES: Record<string, Record<string, string>> = {
  VIP: {
    WHATSAPP: '¡Hola {nombre}! Como cliente VIP tienes acceso anticipado a nuestras nuevas motos y accesorios. ¿Te interesa conocer las últimas novedades? Escríbenos.',
    EMAIL:    'Estimado/a {nombre}, como cliente VIP le informamos sobre nuestros productos exclusivos disponibles esta semana.',
    SMS:      'SIGC Motos: {nombre}, cliente VIP. Nuevos productos disponibles. Más info: sigcmotos.com',
  },
  AT_RISK: {
    WHATSAPP: '¡Hola {nombre}! Te echamos de menos en SIGC Motos. Tenemos una oferta especial para ti: 10% en tu próxima compra. ¿Cuándo puedes visitarnos?',
    EMAIL:    'Hola {nombre}, hace un tiempo no sabemos de ti. Te ofrecemos un descuento especial del 10% en tu próximo servicio.',
    SMS:      'SIGC Motos: {nombre}, tienes un 10% de descuento esperándote. Válido esta semana.',
  },
  DORMANT: {
    WHATSAPP: 'Hola {nombre}, hace mucho tiempo que no nos visitas. ¿Cómo está tu moto? Tenemos servicios de mantenimiento disponibles. ¡Te esperamos!',
    EMAIL:    '{nombre}, ¿recuerdas cuando te atendimos en SIGC Motos? Queremos verte de nuevo. Consulta nuestros planes de mantenimiento.',
    SMS:      'SIGC Motos: {nombre}, ven a revisar tu moto. Tenemos disponibilidad esta semana.',
  },
  LOYAL: {
    WHATSAPP: '¡Hola {nombre}! Gracias por tu fidelidad con SIGC Motos. Como cliente leal tienes prioridad en nuestro taller. ¿Agendamos tu próximo mantenimiento?',
    EMAIL:    'Hola {nombre}, apreciamos tu confianza. Por ser cliente frecuente, te ofrecemos servicio prioritario y descuentos exclusivos.',
    SMS:      'SIGC Motos: {nombre}, cliente frecuente. Agenda tu mantenimiento con prioridad.',
  },
  CHURNED: {
    WHATSAPP: 'Hola {nombre}, sabemos que ha pasado tiempo. En SIGC Motos hemos mejorado nuestros servicios. ¿Nos das la oportunidad de atenderte nuevamente?',
    EMAIL:    '{nombre}, nos gustaría recuperar tu confianza. Hemos mejorado y tenemos una oferta especial de bienvenida.',
    SMS:      'SIGC Motos: {nombre}, vuelve con nosotros. Oferta especial de reactivación.',
  },
  NEW: {
    WHATSAPP: '¡Bienvenido/a {nombre} a SIGC Motos! 🏍️ Queremos que conozcas todos nuestros servicios. Escríbenos si tienes alguna pregunta.',
    EMAIL:    'Bienvenido/a {nombre}. Gracias por elegirnos. Aquí encontrarás todo lo que necesitas para tu moto.',
    SMS:      'SIGC Motos: Bienvenido/a {nombre}. Tu aliado en repuestos y servicios para moto.',
  },
  REGULAR: {
    WHATSAPP: 'Hola {nombre}! Tenemos nuevos productos y servicios en SIGC Motos que pueden interesarte. ¡Cuéntanos cómo podemos ayudarte!',
    EMAIL:    'Hola {nombre}, descubre nuestras novedades en repuestos y accesorios para tu moto.',
    SMS:      'SIGC Motos: {nombre}, novedades disponibles. Visítanos.',
  },
};

function ResultCard({ result }: { result: CampaignResult }) {
  return (
    <div className="mt-6 bg-gray-50 border border-gray-200 rounded-xl p-5 space-y-4">
      <h3 className="font-semibold text-gray-800 flex items-center gap-2">
        <CheckCircle2 size={18} className="text-green-500" />
        Campaña enviada
      </h3>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-green-600 mb-1">
            <Send size={16} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{result.sent}</p>
          <p className="text-xs text-gray-500 mt-0.5">Enviados</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-red-500 mb-1">
            <XCircle size={16} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{result.failed}</p>
          <p className="text-xs text-gray-500 mt-0.5">Fallidos</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-3 text-center">
          <div className="flex items-center justify-center gap-1 text-gray-400 mb-1">
            <SkipForward size={16} />
          </div>
          <p className="text-2xl font-bold text-gray-800">{result.skipped}</p>
          <p className="text-xs text-gray-500 mt-0.5">Omitidos</p>
        </div>
      </div>
    </div>
  );
}

const SEGMENTS = Object.keys(RFM_LABELS) as (keyof typeof RFM_LABELS)[];
const CHANNELS = ['WHATSAPP', 'EMAIL', 'SMS'] as const;

export default function CampaignsPage() {
  const [segment, setSegment] = useState<string>('AT_RISK');
  const [channel, setChannel] = useState<string>('WHATSAPP');
  const [message, setMessage] = useState(TEMPLATES['AT_RISK']['WHATSAPP']);
  const [limit, setLimit]     = useState(200);
  const [sending, setSending] = useState(false);
  const [result, setResult]   = useState<CampaignResult | null>(null);

  const handleSegmentChange = (seg: string) => {
    setSegment(seg);
    setMessage(TEMPLATES[seg]?.[channel] ?? '');
    setResult(null);
  };

  const handleChannelChange = (ch: string) => {
    setChannel(ch);
    setMessage(TEMPLATES[segment]?.[ch] ?? '');
    setResult(null);
  };

  const handleLaunch = async () => {
    if (!message.trim() || message.length < 5) return toast.error('El mensaje es muy corto');
    setSending(true);
    setResult(null);
    try {
      const res = await campaignService.launch({
        segment: segment as any,
        channel: channel as any,
        message,
        limit,
      });
      setResult(res);
      toast.success(`Campaña enviada: ${res.sent} mensajes`);
    } catch {
      toast.error('Error al lanzar campaña');
    } finally {
      setSending(false);
    }
  };

  const rfmBadge = getRfmBadge(segment);

  return (
    <div className="p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Info banner */}
        <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 flex items-start gap-3">
          <Megaphone size={20} className="text-indigo-600 flex-shrink-0 mt-0.5" />
          <div className="text-sm text-indigo-700">
            <p className="font-medium">Campañas masivas por segmento RFM</p>
            <p className="text-indigo-500 mt-0.5">Los mensajes se envían a todos los clientes del segmento seleccionado que tengan el canal disponible. <strong>{'{nombre}'}</strong> se reemplaza automáticamente.</p>
          </div>
        </div>

        {/* Segment selector - CORREGIDO: {SEGMENTS.map en lugar de <SEGMENTS.map */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Segmento de clientes</label>
          <div className="flex flex-wrap gap-2">
            {SEGMENTS.map(seg => {
              const badge = getRfmBadge(seg);
              return (
                <button
                  key={seg}
                  onClick={() => handleSegmentChange(seg)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all border-2 ${
                    segment === seg
                      ? `${badge.className} border-current shadow-sm scale-105`
                      : 'bg-gray-100 text-gray-500 border-transparent hover:bg-gray-200'
                  }`}
                >
                  {badge.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Channel selector */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-3">Canal de envío</label>
          <div className="flex gap-3">
            {CHANNELS.map(ch => (
              <button
                key={ch}
                onClick={() => handleChannelChange(ch)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-medium border-2 transition-all ${
                  channel === ch
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300'
                }`}
              >
                {CHANNEL_LABELS[ch] ?? ch}
              </button>
            ))}
          </div>
        </div>

        {/* Message */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-700">Mensaje</label>
            <span className={`text-xs font-medium ${message.length > 1800 ? 'text-red-500' : 'text-gray-400'}`}>
              {message.length}/2000
            </span>
          </div>
          <textarea
            value={message}
            onChange={e => setMessage(e.target.value)}
            rows={6}
            placeholder="Escribe el mensaje de la campaña..."
            className="w-full border border-gray-300 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none leading-relaxed"
          />
          <p className="text-xs text-gray-400 mt-1.5">
            Usa <code className="bg-gray-100 px-1 rounded">{'{nombre}'}</code> para personalizar con el nombre del cliente.
          </p>
        </div>

        {/* Limit + Launch */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <label className="text-sm font-medium text-gray-600">Máx. destinatarios:</label>
            <input
              type="number"
              min={1}
              max={500}
              value={limit}
              onChange={e => setLimit(Math.min(500, Math.max(1, Number(e.target.value))))}
              className="w-20 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            onClick={handleLaunch}
            disabled={sending || message.length < 5}
            className="ml-auto flex items-center gap-2 px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-sm font-semibold disabled:opacity-50 transition-colors shadow-sm"
          >
            {sending ? (
              <>
                <Spinner size="sm" />
                Enviando...
              </>
            ) : (
              <>
                <Send size={16} />
                Lanzar campaña
              </>
            )}
          </button>
        </div>

        {/* Result */}
        {result && <ResultCard result={result} />}
      </div>
    </div>
  );
}
