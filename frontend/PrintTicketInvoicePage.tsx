import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { invoiceService } from '@/services/invoiceService'
import type { Invoice } from '@/types'
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
  name: 'TALLER Y REPUESTOS CLAVIJOS MOTOS',
  nit: '900.XXX.XXX-X',
  address: 'CRA 16 6-40 AGUACHICA CESAR',
  phone: '3117379097',
  footer: '¡Gracias por su compra! Garantía según política de fábrica.',
}

function paymentLabel(method: string): string {
  const map: Record<string, string> = {
    CASH: 'EFECTIVO', CARD: 'TARJETA', TRANSFER: 'TRANSFERENCIA',
    MIXED: 'MIXTO', CREDIT: 'CRÉDITO / FIADO',
  }
  return map[method] ?? method
}

function trunc(str: string, max: number): string {
  return str.length > max ? str.slice(0, max - 1) + '…' : str
}

export default function PrintTicketInvoicePage() {
  const { invoiceId } = useParams<{ invoiceId: string }>()
  const navigate = useNavigate()
  const [invoice, setInvoice] = useState<any>(null) // Usamos any para depuración temporal
  const [company, setCompany] = useState<CompanyConfig>(DEFAULT_COMPANY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!invoiceId) return
    
    console.log("🔍 Intentando cargar factura ID:", invoiceId)

    invoiceService.getInvoice(invoiceId)
      .then((data: any) => {
        console.log("📦 DATOS RECIBIDOS DEL BACKEND:", data) // 👈 ESTO ES CLAVE PARA VER QUÉ FALTA
        setInvoice(data)
        
        // Intentar cargar config
        fetch('/api/v1/config')
          .then(r => r.json())
          .then(d => {
             if (d.data) setCompany({ ...DEFAULT_COMPANY, ...d.data })
          })
          .catch(() => {})
      })
      .catch((err) => {
        console.error("❌ Error cargando factura:", err)
        setError('No se pudo cargar la factura')
      })
      .finally(() => setLoading(false))
  }, [invoiceId])

  if (loading) return <div className="ticket-wrapper"><p className="text-center text-gray-500">Cargando...</p></div>
  if (error || !invoice) {
    return (
      <div className="ticket-wrapper text-center p-4">
        <p className="text-red-500 mb-4">{error || 'Factura no encontrada'}</p>
        <button onClick={() => navigate(-1)} className="btn-outline">Volver</button>
      </div>
    )
  }

  // ✅ CORRECCIÓN: Buscar la fecha en múltiples campos posibles
  const rawDate = invoice.issuedAt || invoice.createdAt || invoice.date || new Date().toISOString()
  const d = new Date(rawDate)
  const invDate = isNaN(d.getTime()) ? new Date().toLocaleDateString('es-CO') : d.toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit', year: 'numeric' })
  const invTime = isNaN(d.getTime()) ? new Date().toLocaleTimeString('es-CO') : d.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', hour12: true })

  // ✅ CORRECCIÓN: Buscar totales en múltiples campos posibles
  const total = Number(invoice.totalAmount ?? invoice.total ?? invoice.grandTotal ?? 0)
  const taxAmount = Number(invoice.taxAmount ?? invoice.taxTotal ?? invoice.iva ?? 0)
  const discountAmt = Number(invoice.discountAmount ?? invoice.discountTotal ?? invoice.discount ?? 0)
  const taxBase = taxAmount > 0 ? total - taxAmount : (Number(invoice.subtotal ?? 0) - discountAmt)

  // ✅ CORRECCIÓN: Verificar items
  const items = invoice.items ?? invoice.products ?? []
  const verifyUrl = `${window.location.origin}/print-ticket-invoice/${invoiceId}`

  return (
    <div className="ticket-wrapper">
      <div className="ticket-actions no-print">
        <button className="btn-outline flex items-center gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <button className="btn-primary flex items-center gap-2" onClick={() => window.print()}>
          <Printer className="w-4 h-4" /> Imprimir Ticket
        </button>
      </div>

      <div className="ticket-preview">
        <div className="ticket-header">
          <p className="ticket-logo-text">CLAVIJOS MOTOS</p>
          <p className="ticket-company-name">{company.name}</p>
          <p className="ticket-company-sub">NIT: {company.nit}</p>
          <p className="ticket-company-sub">{company.address}</p>
          <p className="ticket-company-sub">Tel: {company.phone}</p>
        </div>

        <div className="ticket-doc-type">
          <p>— DOCUMENTO EQUIVALENTE —</p>
          <p>TICKET DE FACTURA</p>
        </div>

        <div className="ticket-meta">
          <table>
            <tbody>
              <tr><td>Fecha:</td><td>{invDate}</td></tr>
              <tr><td>Hora:</td><td>{invTime}</td></tr>
              <tr><td>No. Factura:</td><td><strong>{invoice.invoiceNumber ?? invoice.number ?? 'N/A'}</strong></td></tr>
              <tr>
                <td>Cliente:</td>
                <td>{invoice.customer?.name?.toUpperCase() ?? 'CONSUMIDOR FINAL'}</td>
              </tr>
              {invoice.customer?.documentNumber && (
                <tr><td>C.C./NIT:</td><td>{invoice.customer.documentNumber}</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ticket-items">
          <table>
            <thead>
              <tr>
                <th className="col-qty">CNT</th>
                <th className="col-desc" style={{width: '50%'}}>DESCRIPCIÓN</th>
                <th className="col-total">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {items.length > 0 ? items.map((item: any, i: number) => {
                const lineTotal = Number(item.lineTotal ?? item.subtotal ?? item.total ?? 0)
                const unitPrice = Number(item.unitPrice ?? item.price ?? 0)
                const name = item.productNameSnapshot ?? item.product?.name ?? item.name ?? 'Producto'
                
                return (
                  <tr key={i} className="ticket-item-row">
                    <td className="col-qty">{item.quantity}</td>
                    <td className="col-desc">
                      <div className="item-name-line">{trunc(name, 25)}</div>
                      <div className="item-unit-line">V.Unit: {formatCOP(unitPrice)}</div>
                    </td>
                    <td className="col-total">{formatCOP(lineTotal)}</td>
                  </tr>
                )
              }) : (
                <tr><td colSpan={3} className="text-center text-xs text-gray-400 py-2">Sin productos</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="ticket-totals">
          <table>
            <tbody>
              {discountAmt > 0 && (
                <tr><td>Descuento:</td><td>-{formatCOP(discountAmt)}</td></tr>
              )}
              <tr><td>Base Gravable:</td><td>{formatCOP(taxBase)}</td></tr>
              <tr><td>IVA (19%):</td><td>{formatCOP(taxAmount)}</td></tr>
              <tr className="ticket-total-row">
                <td>TOTAL:</td><td>{formatCOP(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {invoice.paymentMethod && (
          <div className="ticket-payment-block">
            <p className="ticket-payment-label">FORMA DE PAGO</p>
            <table className="ticket-payment-table">
              <tbody>
                <tr>
                  <td>{paymentLabel(invoice.paymentMethod)}</td>
                  <td>{formatCOP(total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        <div className="ticket-qr">
          <QRCodeSVG value={verifyUrl} size={72} level="M" />
          <p style={{ fontSize: '8px', marginTop: '3px', color: '#888' }}>Escanea para verificar</p>
        </div>

        <div className="ticket-footer">
          <p>SIGC-Motos v2.0 | Powered by Quanta Cloud</p>
          <p style={{ marginTop: '4px' }}>{company.footer}</p>
          <p style={{ marginTop: '6px', fontSize: '8px' }}>No es factura electrónica DIAN</p>
        </div>
      </div>
    </div>
  )
}
