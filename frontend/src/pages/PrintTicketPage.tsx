import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { posService } from '@/services/posService'
import { configService } from '@/services/configService'
import api from '@/services/api'
import type { Sale } from '@/types'
import { formatCOP } from '@/utils/formatters'
import '@/styles/print-ticket.css'

interface CompanyConfig {
  name: string
  nit: string
  address: string
  phone: string
  email?: string
  footer?: string
}

const DEFAULT_COMPANY: CompanyConfig = {
  name: 'TALLER Y REPUESTOS CLAVIJOS',
  nit: 'N/A',
  address: 'Dirección no configurada',
  phone: 'Sin teléfono',
  footer: '¡Gracias por su compra! Garantía según política de fábrica.',
}

function formatTicketDate(iso: string) {
  const d = new Date(iso)
  const date = d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const time = d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })
  return { date, time }
}

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: 'EFECTIVO', CARD: 'TARJETA', TRANSFER: 'TRANSFERENCIA',
    MIXED: 'MIXTO', CREDIT: 'CRÉDITO / FIADO',
    EFECTIVO: 'EFECTIVO', TARJETA_CREDITO: 'TARJETA', TARJETA_DEBITO: 'TARJETA',
    TRANSFERENCIA_BANCARIA: 'TRANSFERENCIA', MIXTO: 'MIXTO',
  }
  return map[method] ?? method
}

export default function PrintTicketPage() {
  const { saleId } = useParams<{ saleId: string }>()
  const [cfg, setCfg] = useState<any>(null);
  const [sale, setSale] = useState<Sale | null>(null)
  const [company, setCompany] = useState<CompanyConfig>(DEFAULT_COMPANY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!saleId) return
    configService.getConfig().then(setCfg).catch(console.error)

    Promise.all([
      posService.getSale(saleId),
      api.get('/config')
        .then(r => {
          const d = r.data?.data ?? r.data
          return { name: d.businessName, nit: d.nit, address: d.address, phone: d.phone, email: d.email, footer: d.footer }
        })
        .catch(() => DEFAULT_COMPANY),
    ])
      .then(([saleData, configData]) => {
        setSale(saleData)
        if (configData && typeof configData === 'object') {
          setCompany({ ...DEFAULT_COMPANY, ...configData })
        }
      })
      .catch(() => setError('No se pudo cargar la venta'))
      .finally(() => setLoading(false))
  }, [saleId])

  if (loading) {
    return (
      <div className="ticket-wrapper">
        <div className="ticket-actions">
          <p className="text-gray-500 text-sm font-bold">Cargando comprobante...</p>
        </div>
      </div>
    )
  }

  if (error || !sale) {
    return (
      <div className="ticket-wrapper">
        <div className="ticket-actions">
          <button className="btn-outline flex items-center gap-2 font-bold" onClick={() => window.close()}>
            <ArrowLeft className="w-4 h-4" /> Cerrar
          </button>
        </div>
        <p className="text-red-500 text-center mt-4 font-bold">{error || 'Venta no encontrada'}</p>
      </div>
    )
  }

  const { date: saleDate, time: saleTime } = formatTicketDate(sale.createdAt)

  const total         = Number(sale.totalAmount  ?? sale.total        ?? 0)
  const taxAmount     = Number(sale.taxAmount    ?? sale.taxTotal     ?? 0)
  const discountAmt   = Number(sale.discountAmount ?? sale.discountTotal ?? 0)
  const taxBase       = taxAmount > 0 ? total - taxAmount : Number(sale.subtotal ?? 0) - discountAmt
  const isCreditSale  = sale.paymentMethod === 'CREDIT'
  const verifyUrl     = `${window.location.origin}/print-ticket/${sale.id}`
  const cashierName   = (sale as Sale & { cashier?: { name: string } }).cashier?.name

  return (
    <div className="ticket-wrapper">
      {/* Controles — ocultos al imprimir */}
      <div className="ticket-actions">
        <button className="btn-outline flex items-center gap-2 font-bold" onClick={() => window.close()}>
          <ArrowLeft className="w-4 h-4" /> Cerrar
        </button>
        <button className="btn-primary flex items-center gap-2 font-bold" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Imprimir Ticket
        </button>
      </div>

      {/* ══════════════ TICKET ══════════════ */}
      <div className="ticket-preview">

        {/* ENCABEZADO - SIN LOGO, TODO EN NEGRITA */}
        <div className="ticket-header">
          {/* Logo removido */}
          <p className="ticket-company-name font-bold">{company.name}</p>
          <p className="ticket-company-sub font-bold">NIT: {company.nit}</p>
          <p className="ticket-company-sub font-bold">{company.address}</p>
          <p className="ticket-company-sub font-bold">Tel: {company.phone}</p>
        </div>

        {/* TIPO DE DOCUMENTO */}
        <div className="ticket-doc-type font-bold">
          <p>—  DOCUMENTO EQUIVALENTE  —</p>
          <p>TICKET DE VENTA POS</p>
        </div>

        {/* DATOS DE LA VENTA */}
        <div className="ticket-meta font-bold">
          <table>
            <tbody>
              <tr><td className="font-bold">Fecha:</td><td className="font-bold">{saleDate}</td></tr>
              <tr><td className="font-bold">Hora:</td><td className="font-bold">{saleTime}</td></tr>
              <tr>
                <td className="font-bold">No. Venta:</td>
                <td className="font-bold"><strong>{sale.saleNumber}</strong></td>
              </tr>
              <tr>
                <td className="font-bold">Adquiriente:</td>
                <td className="font-bold">{(sale.customerName || sale.customer?.name)?.toUpperCase() || 'CONSUMIDOR FINAL'}</td>
              </tr>
              {sale.customer?.identificationNumber && (
                <tr>
                  <td className="font-bold">C.C./NIT:</td>
                  <td className="font-bold">{sale.customer.identificationNumber}</td>
                </tr>
              )}
              {sale.customerIdentification && (
                <tr>
                  <td className="font-bold">C.C./NIT:</td>
                  <td className="font-bold">{sale.customerIdentification}</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* TABLA DE ÍTEMS */}
        <div className="ticket-items font-bold">
          <table>
            <thead>
              <tr>
                <th className="col-qty font-bold">CNT</th>
                <th className="col-ref font-bold">REF</th>
                <th className="col-desc font-bold">DESCRIPCIÓN</th>
                <th className="col-total font-bold">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {sale.items.map((item, i) => {
                const lineTotal  = Number(item.lineTotal ?? item.subtotal ?? 0)
                const unitPrice  = Number(item.unitPrice ?? 0)
                const name       = item.productNameSnapshot ?? item.product?.name ?? 'Producto'
                const sku        = item.skuSnapshot ?? ''
                return (
                  <tr key={i} className="ticket-item-row font-bold">
                    <td className="col-qty font-bold">{item.quantity}</td>
                    <td className="col-ref font-bold">{sku}</td>
                    <td className="col-desc font-bold">
                      <div className="item-name-line font-bold">{name}</div>
                      <div className="item-unit-line font-bold">V.Unit: {formatCOP(unitPrice)}</div>
                    </td>
                    <td className="col-total font-bold">{formatCOP(lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* TOTALES Y PAGOS */}
        <div className="mt-4 pt-2 border-t border-gray-300 font-bold">
          <table className="w-full text-sm">
            <tbody>
              {Number(sale.discountAmount || 0) > 0 && (
                <tr>
                  <td className="py-1 text-gray-600 font-bold">Descuento:</td>
                  <td className="text-right text-red-600 font-bold">-{formatCOP(Number(sale.discountAmount))}</td>
                </tr>
              )}
              <tr>
                <td className="py-1 font-bold">Base Gravable:</td>
                <td className="text-right font-bold">{formatCOP(Number(sale.totalAmount || 0) - Number(sale.taxAmount || 0))}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold">IVA:</td>
                <td className="text-right font-bold">{formatCOP(Number(sale.taxAmount || 0))}</td>
              </tr>
              <tr className="border-t-2 border-gray-400 font-bold text-base">
                <td className="py-2 font-bold">TOTAL:</td>
                <td className="text-right font-bold">{formatCOP(Number(sale.totalAmount || 0))}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* EFECTIVO Y CAMBIO */}
        {Number(sale.cashReceived || 0) > 0 && (
          <div className="mt-3 pt-2 border-t border-dashed border-gray-300 font-bold">
            <table className="w-full text-sm">
              <tbody>
                <tr>
                  <td className="py-1 text-gray-600 font-bold">EFECTIVO RECIBIDO:</td>
                  <td className="text-right font-bold">{formatCOP(Number(sale.cashReceived))}</td>
                </tr>
                {Number(sale.changeAmount || 0) > 0 && (
                  <tr className="text-green-700 font-bold">
                    <td className="py-1 font-bold">CAMBIO:</td>
                    <td className="text-right font-bold">{formatCOP(Number(sale.changeAmount))}</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* FORMA DE PAGO */}
        <div className="mt-3 pt-2 border-t border-dashed border-gray-300 font-bold">
          <p className="text-xs text-gray-500 uppercase font-bold">Forma de Pago</p>
          <p className="font-bold">{paymentLabel(sale.paymentMethod)}</p>
        </div>

        {/* QR */}
        <div className="mt-4 pt-2 border-t border-dashed border-gray-300 text-center font-bold">
          <QRCodeSVG value={verifyUrl} size={120} />
          <p className="text-[10px] text-gray-500 mt-1 font-bold">Escanea para verificar</p>
        </div>

        {/* PIE */}
        <div className="ticket-footer font-bold">
          {cashierName && <p className="font-bold">Atendido por: {cashierName}</p>}
          <p className="font-bold">SIGC-Motos v2.0 | Powered by Quanta Cloud</p>
          <p style={{ marginTop: '4px' }} className="font-bold">{company.footer}</p>
          <p style={{ marginTop: '6px', fontSize: '8px' }} className="font-bold">
            No es factura electrónica DIAN
          </p>
        </div>
      </div>
    </div>
  )
}
