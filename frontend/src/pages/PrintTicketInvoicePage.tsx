import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { invoiceService } from '@/services/invoiceService'
import { configService } from '@/services/configService'
import { formatCOP } from '@/utils/formatters'
import '@/styles/print-ticket.css'

interface CompanyConfig {
  name: string
  nit: string
  address: string
  phone: string
  email?: string
  footer?: string
  logoKey?: string
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

export default function PrintTicketInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const [ticketData, setTicketData] = useState<any>(null)
  const [company, setCompany] = useState<CompanyConfig>(DEFAULT_COMPANY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    // Cargar configuración de la empresa
    const loadConfig = async () => {
      try {
        const config = await configService.getConfig()
        setCompany({
          name: config.businessName ?? DEFAULT_COMPANY.name,
          nit: config.nit ?? DEFAULT_COMPANY.nit,
          address: config.address ?? DEFAULT_COMPANY.address,
          phone: config.phone ?? DEFAULT_COMPANY.phone,
          email: config.email ?? undefined,
          footer: config.footer ?? DEFAULT_COMPANY.footer,
          logoKey: config.logoKey ?? null,
        })
      } catch (err) {
        console.error("Error cargando config de empresa:", err)
        setCompany(DEFAULT_COMPANY)
      }
    }
    loadConfig()

    // Cargar datos de la factura
    if (!invoiceId) { setError('No invoice ID'); setLoading(false); return }

    invoiceService.getInvoice(invoiceId)
      .then((response: any) => {
        const data = response?.data ?? response
        setTicketData(data)
      })
      .catch((err: any) => {
        console.error("❌ Error:", err)
        setError(err.message || 'Error cargando factura')
      })
      .finally(() => setLoading(false))
  }, [invoiceId])

  if (loading) return <div className="p-4 text-center font-bold">Cargando ticket...</div>

  if (error || !ticketData) {
    return (
      <div className="p-4 text-center">
        <p className="text-red-500 mb-4 font-bold">{error || 'Factura no encontrada'}</p>
        <button onClick={() => navigate(-1)} className="btn-outline font-bold">Volver</button>
      </div>
    )
  }

  // Mapeo de datos del backend
  const invoice = ticketData.invoice ?? {}
  const customer = ticketData.customer ?? {}
  const items = ticketData.items ?? []
  const totals = ticketData.totals ?? {}
  const header = ticketData.header ?? {}
  const footer = ticketData.footer ?? {}

  // Fechas
  const rawDate = invoice.date ?? invoice.issuedAt ?? invoice.createdAt ?? new Date().toISOString()
  const { date: invDate, time: invTime } = formatTicketDate(rawDate)

  // Totales
  const total = Number(totals.total ?? totals.grandTotal ?? invoice.totalAmount ?? invoice.total ?? 0)
  const taxAmount = Number(totals.taxAmount ?? totals.iva ?? invoice.taxAmount ?? invoice.taxTotal ?? 0)
  const discountAmt = Number(totals.discount ?? invoice.discountAmount ?? 0)
  const taxBase = taxAmount > 0 ? total - taxAmount : Number(totals.subtotal ?? 0) - discountAmt
  const cashReceived = Number(invoice.cashReceived ?? totals.cashReceived ?? 0)
  const changeAmount = Number(invoice.changeAmount ?? totals.change ?? 0)

  return (
    <div className="ticket-wrapper">
      <div className="ticket-actions no-print flex gap-2">
        <button className="btn-outline flex items-center gap-2 font-bold" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4"/> Volver
        </button>
        <button className="btn-primary flex items-center gap-2 font-bold" onClick={() => window.print()}>
          <Printer className="w-4 h-4"/> Imprimir Ticket
        </button>
      </div>

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
          <p>— DOCUMENTO EQUIVALENTE —</p>
          <p>TICKET DE FACTURA</p>
        </div>

        {/* DATOS DE LA FACTURA */}
        <div className="ticket-meta font-bold">
          <table>
            <tbody>
              <tr><td className="font-bold">Fecha:</td><td className="font-bold">{invDate}</td></tr>
              <tr><td className="font-bold">Hora:</td><td className="font-bold">{invTime}</td></tr>
              <tr><td className="font-bold">No. Factura:</td><td><strong className="font-bold">{invoice.number ?? invoice.invoiceNumber ?? 'N/A'}</strong></td></tr>
              <tr>
                <td className="font-bold">Adquiriente:</td>
                <td className="font-bold">{(invoice.customerName || customer.name)?.toUpperCase() || 'CONSUMIDOR FINAL'}</td>
              </tr>
              {(invoice.customerIdentification || customer.identification) && (
                <tr><td className="font-bold">C.C./NIT:</td><td className="font-bold">{invoice.customerIdentification || customer.identification}</td></tr>
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
              {items.length > 0 ? items.map((item:any, i:number) => {
                const lineTotal = Number(item.lineTotal ?? item.total ?? item.subtotal ?? 0)
                const unitPrice = Number(item.unitPrice ?? item.price ?? 0)
                const qty = Number(item.qty ?? item.quantity ?? 1)
                const name = item.name ?? item.productNameSnapshot ?? item.product?.name ?? 'Producto'
                const sku = item.sku ?? item.code ?? item.skuSnapshot ?? ''
                return (
                  <tr key={i} className="ticket-item-row font-bold">
                    <td className="col-qty font-bold">{qty}</td>
                    <td className="col-ref font-bold">{sku}</td>
                    <td className="col-desc font-bold">
                      <div className="item-name-line font-bold">{name}</div>
                      <div className="item-unit-line font-bold">V.Unit: {formatCOP(unitPrice)}</div>
                    </td>
                    <td className="col-total font-bold">{formatCOP(lineTotal)}</td>
                  </tr>
                )
              }) : <tr><td colSpan={4} className="text-center text-xs text-gray-400 py-2 font-bold">Sin productos</td></tr>}
            </tbody>
          </table>
        </div>

        {/* TOTALES Y PAGOS */}
        <div className="mt-4 pt-2 border-t border-gray-300 font-bold">
          <table className="w-full text-sm">
            <tbody>
              {discountAmt > 0 && (
                <tr>
                  <td className="py-1 text-gray-600 font-bold">Descuento:</td>
                  <td className="text-right text-red-600 font-bold">-{formatCOP(discountAmt)}</td>
                </tr>
              )}
              <tr>
                <td className="py-1 font-bold">Base Gravable:</td>
                <td className="text-right font-bold">{formatCOP(taxBase)}</td>
              </tr>
              <tr>
                <td className="py-1 font-bold">IVA:</td>
                <td className="text-right font-bold">{formatCOP(taxAmount)}</td>
              </tr>
              {cashReceived > 0 && (
                <tr>
                  <td className="py-1 text-gray-600 font-bold">Efectivo:</td>
                  <td className="text-right font-bold">{formatCOP(cashReceived)}</td>
                </tr>
              )}
              {changeAmount > 0 && (
                <tr>
                  <td className="py-1 text-gray-600 font-bold">Cambio:</td>
                  <td className="text-right font-bold">{formatCOP(changeAmount)}</td>
                </tr>
              )}
              <tr className="border-t-2 border-gray-400 font-bold text-base">
                <td className="py-2 font-bold">TOTAL:</td>
                <td className="text-right font-bold">{formatCOP(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FORMA DE PAGO */}
        {invoice.paymentMethod && (
          <div className="ticket-payment-block mt-2 font-bold">
            <p className="ticket-payment-label font-bold">FORMA DE PAGO</p>
            <table className="ticket-payment-table w-full text-sm">
              <tbody>
                <tr>
                  <td className="font-bold">{paymentLabel(invoice.paymentMethod)}</td>
                  <td className="text-right font-bold">{formatCOP(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* QR */}
        <div className="ticket-qr mt-4 text-center font-bold">
          <QRCodeSVG value={`${window.location.origin}/print-ticket-invoice/${invoiceId}`} size={72} />
          <p style={{fontSize:'8px',marginTop:'3px',color:'#888'}} className="font-bold">Escanea para verificar</p>
        </div>

        {/* PIE */}
        <div className="ticket-footer mt-4 pt-2 border-t border-gray-200 text-center text-xs text-gray-500 font-bold">
          <p className="font-bold">SIGC-Motos v2.0 | Powered by Quanta Cloud</p>
          <p style={{marginTop:'4px'}} className="font-bold">{company.footer ?? footer.message ?? '¡Gracias por su compra!'}</p>
          <p style={{marginTop:'6px',fontSize:'8px'}} className="font-bold">No es factura electrónica DIAN</p>
        </div>
      </div>
    </div>
  )
}
