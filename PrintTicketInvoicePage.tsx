import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Printer, ArrowLeft } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { invoiceService } from '@/services/invoiceService'
import type { Invoice } from '@/types'
import { formatCOP, formatDateTime } from '@/utils/formatters'
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
  const [invoice, setInvoice] = useState<Invoice | null>(null)
  const [company, setCompany] = useState<CompanyConfig>(DEFAULT_COMPANY)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!invoiceId) return
    Promise.all([
      invoiceService.getById(invoiceId),
      // Intentar cargar config, si falla usar default
      fetch('/api/v1/config')
        .then(r => r.json())
        .then(d => d.data ?? d)
        .catch(() => null),
    ])
      .then(([invData, configData]) => {
        setInvoice(invData)
        if (configData) {
          setCompany({ ...DEFAULT_COMPANY, ...configData })
        }
      })
      .catch(() => setError('No se pudo cargar la factura'))
      .finally(() => setLoading(false))
  }, [invoiceId])

  const handlePrint = () => {
    window.print()
  }

  if (loading) {
    return (
      <div className="ticket-wrapper">
        <div className="ticket-actions">
          <p className="text-gray-500 text-sm">Cargando factura...</p>
        </div>
      </div>
    )
  }

  if (error || !invoice) {
    return (
      <div className="ticket-wrapper">
        <div className="ticket-actions">
          <button className="btn-outline flex items-center gap-2" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-4 h-4" /> Volver
          </button>
        </div>
        <p className="text-red-500 text-center mt-4">{error || 'Factura no encontrada'}</p>
      </div>
    )
  }

  const { date: invDate, time: invTime } = formatDateTime(invoice.issuedAt).split(' ')
  const total = Number(invoice.totalAmount ?? invoice.total ?? 0)
  const taxAmount = Number(invoice.taxAmount ?? invoice.taxTotal ?? 0)
  const discountAmt = Number(invoice.discountAmount ?? invoice.discountTotal ?? 0)
  const taxBase = taxAmount > 0 ? total - taxAmount : (Number(invoice.subtotal ?? 0) - discountAmt)
  const verifyUrl = `${window.location.origin}/print-ticket-invoice/${invoice.id}`

  return (
    <div className="ticket-wrapper">
      {/* Controles — ocultos al imprimir */}
      <div className="ticket-actions no-print">
        <button className="btn-outline flex items-center gap-2" onClick={() => navigate(-1)}>
          <ArrowLeft className="w-4 h-4" /> Volver
        </button>
        <button className="btn-primary flex items-center gap-2" onClick={handlePrint}>
          <Printer className="w-4 h-4" /> Imprimir Ticket
        </button>
      </div>

      {/* ══════════════ TICKET ══════════════ */}
      <div className="ticket-preview">
        {/* ENCABEZADO */}
        <div className="ticket-header">
          <p className="ticket-logo-text">CLAVIJOS MOTOS</p>
          <p className="ticket-company-name">{company.name}</p>
          <p className="ticket-company-sub">NIT: {company.nit}</p>
          <p className="ticket-company-sub">{company.address}</p>
          <p className="ticket-company-sub">Tel: {company.phone}</p>
        </div>

        {/* TIPO DE DOCUMENTO */}
        <div className="ticket-doc-type">
          <p>— DOCUMENTO EQUIVALENTE —</p>
          <p>TICKET DE FACTURA</p>
        </div>

        {/* DATOS DE LA FACTURA */}
        <div className="ticket-meta">
          <table>
            <tbody>
              <tr><td>Fecha:</td><td>{invDate}</td></tr>
              <tr><td>Hora:</td><td>{invTime}</td></tr>
              <tr><td>No. Factura:</td><td><strong>{invoice.invoiceNumber}</strong></td></tr>
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

        {/* TABLA DE ÍTEMS */}
        <div className="ticket-items">
          <table>
            <thead>
              <tr>
                <th className="col-qty">CNT</th>
                <th className="col-ref">REF</th>
                <th className="col-desc">DESCRIPCIÓN</th>
                <th className="col-total">TOTAL</th>
              </tr>
            </thead>
            <tbody>
              {(invoice.items ?? []).map((item, i) => {
                const lineTotal = Number(item.lineTotal ?? item.subtotal ?? 0)
                const unitPrice = Number(item.unitPrice ?? 0)
                const name = item.productNameSnapshot ?? item.product?.name ?? 'Producto'
                const sku = item.skuSnapshot ?? item.product?.sku ?? ''
                return (
                  <tr key={i} className="ticket-item-row">
                    <td className="col-qty">{item.quantity}</td>
                    <td className="col-ref">{trunc(sku, 10)}</td>
                    <td className="col-desc">
                      <div className="item-name-line">{trunc(name, 20)}</div>
                      <div className="item-unit-line">V.Unit: {formatCOP(unitPrice)}</div>
                    </td>
                    <td className="col-total">{formatCOP(lineTotal)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* TOTALES */}
        <div className="ticket-totals">
          <table>
            <tbody>
              {discountAmt > 0 && (
                <tr><td>Descuento:</td><td>-{formatCOP(discountAmt)}</td></tr>
              )}
              <tr><td>Base Gravable:</td><td>{formatCOP(taxBase)}</td></tr>
              <tr><td>IVA (19%):</td><td>{formatCOP(taxAmount)}</td></tr>
              <tr className="ticket-total-row">
                <td>TOTAL:</td>
                <td>{formatCOP(total)}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* FORMA DE PAGO */}
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

        {/* QR */}
        <div className="ticket-qr">
          <QRCodeSVG value={verifyUrl} size={72} level="M" />
          <p style={{ fontSize: '8px', marginTop: '3px', color: '#888' }}>Escanea para verificar</p>
        </div>

        {/* PIE */}
        <div className="ticket-footer">
          <p>SIGC-Motos v2.0 | Powered by Quanta Cloud</p>
          <p style={{ marginTop: '4px' }}>{company.footer}</p>
          <p style={{ marginTop: '6px', fontSize: '8px' }}>No es factura electrónica DIAN</p>
        </div>
      </div>
    </div>
  )
}
