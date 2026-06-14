import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useEffect, useCallback } from 'react';
import { FileText, Download, Send, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { invoiceService } from '@/services/invoiceService';
import { PageHeader } from '@/components/ui/PageHeader';
import { Card } from '@/components/ui/Card';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { formatCOP, formatDateTime, invoiceStatusBadge } from '@/utils/formatters';
import { exportInvoicesToExcel } from '@/utils/excelExport';
import { generateInvoicePDF } from '@/utils/pdfGenerator';
const statusOptions = [
    { value: '', label: 'Todos los estados' },
    { value: 'EMITIDA', label: 'Emitida' },
    { value: 'ANULADA', label: 'Anulada' },
    { value: 'ENVIADA_DIAN', label: 'Enviada DIAN' },
];
export default function Invoices() {
    const [invoices, setInvoices] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [selectedInvoice, setSelectedInvoice] = useState(null);
    const [detailModal, setDetailModal] = useState(false);
    const [cancelDialog, setCancelDialog] = useState(false);
    const [cancelReason, setCancelReason] = useState('');
    const [cancelLoading, setCancelLoading] = useState(false);
    const [dianLoading, setDianLoading] = useState(null);
    const LIMIT = 20;
    const load = useCallback(async (p = page, status = statusFilter, sd = startDate, ed = endDate) => {
        setLoading(true);
        try {
            const res = await invoiceService.getInvoices({ page: p, limit: LIMIT, status: status || undefined, startDate: sd || undefined, endDate: ed || undefined });
            setInvoices(res.data);
            setTotal(res.total);
            setTotalPages(res.totalPages);
        }
        catch { /* handled */ }
        finally {
            setLoading(false);
        }
    }, [statusFilter, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { load(); }, [statusFilter, startDate, endDate]); // eslint-disable-line react-hooks/exhaustive-deps
    const handleFilter = () => { setPage(1); load(1, statusFilter, startDate, endDate); };
    const handleCancel = async () => {
        if (!selectedInvoice || !cancelReason.trim()) {
            toast.error('Ingresa el motivo de anulación');
            return;
        }
        setCancelLoading(true);
        try {
            await invoiceService.cancelInvoice(selectedInvoice.id, cancelReason);
            toast.success('Factura anulada correctamente');
            setCancelDialog(false);
            setCancelReason('');
            load(page, statusFilter, startDate, endDate);
        }
        catch (err) {
            const msg = err?.response?.data?.message ?? 'Error al anular factura';
            toast.error(msg);
        }
        finally {
            setCancelLoading(false);
        }
    };
    const handleSendDian = async (invoice) => {
        setDianLoading(invoice.id);
        try {
            await invoiceService.sendToDian(invoice.id);
            toast.success('Factura enviada a DIAN correctamente');
            load(page, statusFilter, startDate, endDate);
        }
        catch (err) {
            const msg = err?.response?.data?.message ?? 'Error al enviar a DIAN';
            toast.error(msg);
        }
        finally {
            setDianLoading(null);
        }
    };
    const handleExport = async () => {
        if (invoices.length === 0) {
            toast.warning('No hay facturas para exportar');
            return;
        }
        await exportInvoicesToExcel(invoices);
        toast.success('Excel exportado correctamente');
    };
    const statusVariant = (s) => {
        if (s === 'EMITIDA')
            return 'blue';
        if (s === 'ANULADA')
            return 'red';
        if (s === 'ENVIADA_DIAN')
            return 'green';
        return 'gray';
    };
    return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Facturaci\u00F3n", description: "Historial de facturas emitidas", actions: _jsxs("button", { className: "btn-outline btn-sm", onClick: handleExport, children: [_jsx(Download, { className: "w-4 h-4" }), " Exportar Excel"] }) }), _jsx(Card, { className: "mb-4 p-4", children: _jsxs("div", { className: "flex flex-wrap gap-3 items-end", children: [_jsxs("div", { children: [_jsx("label", { className: "label", children: "Estado" }), _jsx("select", { className: "input-field w-44", value: statusFilter, onChange: (e) => setStatusFilter(e.target.value), children: statusOptions.map((s) => _jsx("option", { value: s.value, children: s.label }, s.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Desde" }), _jsx("input", { type: "date", className: "input-field w-40", value: startDate, onChange: (e) => setStartDate(e.target.value) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Hasta" }), _jsx("input", { type: "date", className: "input-field w-40", value: endDate, onChange: (e) => setEndDate(e.target.value) })] }), _jsx("button", { className: "btn-secondary btn-sm", onClick: handleFilter, children: "Filtrar" }), _jsx("button", { className: "btn-ghost btn-sm text-gray-500", onClick: () => { setStatusFilter(''); setStartDate(''); setEndDate(''); setPage(1); load(1, '', '', ''); }, children: "Limpiar" })] }) }), _jsxs(Card, { className: "overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: loading ? _jsx(TableSkeleton, { rows: 8, cols: 6 }) : invoices.length === 0 ? (_jsx(EmptyState, { icon: _jsx(FileText, { className: "w-8 h-8" }), title: "Sin facturas", description: "No se encontraron facturas con los filtros aplicados." })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-50 border-b border-gray-200", children: [_jsx("th", { className: "table-th", children: "N\u00FAmero" }), _jsx("th", { className: "table-th", children: "Fecha" }), _jsx("th", { className: "table-th", children: "Cliente" }), _jsx("th", { className: "table-th", children: "Total" }), _jsx("th", { className: "table-th", children: "Estado" }), _jsx("th", { className: "table-th", children: "Acciones" })] }) }), _jsx("tbody", { children: invoices.map((inv) => {
                                        const st = invoiceStatusBadge(inv.status);
                                        return (_jsxs("tr", { className: "table-row", children: [_jsx("td", { className: "table-td font-mono text-xs font-semibold text-blue-900", children: inv.invoiceNumber }), _jsx("td", { className: "table-td text-gray-500 text-xs", children: formatDateTime(inv.issuedAt) }), _jsx("td", { className: "table-td", children: inv.customer?.name ?? 'Consumidor Final' }), _jsx("td", { className: "table-td font-semibold", children: formatCOP(inv.total) }), _jsx("td", { className: "table-td", children: _jsx(Badge, { variant: statusVariant(inv.status), children: st.label }) }), _jsx("td", { className: "table-td", children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => { setSelectedInvoice(inv); setDetailModal(true); }, className: "p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors", title: "Ver detalle", children: _jsx(Eye, { className: "w-4 h-4" }) }), inv.status === 'EMITIDA' && (_jsxs(_Fragment, { children: [_jsx("button", { onClick: () => handleSendDian(inv), disabled: dianLoading === inv.id, className: "p-1.5 rounded hover:bg-green-50 text-green-600 transition-colors", title: "Enviar a DIAN", children: dianLoading === inv.id ? _jsx(Spinner, { size: "sm" }) : _jsx(Send, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => { setSelectedInvoice(inv); setCancelDialog(true); }, className: "p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors", title: "Anular factura", children: _jsx(XCircle, { className: "w-4 h-4" }) })] })), _jsx("button", { onClick: () => generateInvoicePDF(inv), className: "p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors", title: "Descargar PDF", children: _jsx(Download, { className: "w-4 h-4" }) })] }) })] }, inv.id));
                                    }) })] })) }), !loading && invoices.length > 0 && (_jsx(Pagination, { page: page, totalPages: totalPages, total: total, limit: LIMIT, onPageChange: (p) => { setPage(p); load(p, statusFilter, startDate, endDate); } }))] }), _jsx(Modal, { open: detailModal, onClose: () => setDetailModal(false), title: `Factura ${selectedInvoice?.invoiceNumber ?? ''}`, size: "lg", footer: _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-outline", onClick: () => setDetailModal(false), children: "Cerrar" }), selectedInvoice && (_jsxs("button", { className: "btn-primary", onClick: () => generateInvoicePDF(selectedInvoice), children: [_jsx(Download, { className: "w-4 h-4" }), " Descargar PDF"] }))] }), children: selectedInvoice && (_jsxs("div", { className: "space-y-4", children: [_jsxs("div", { className: "grid grid-cols-2 gap-4 text-sm", children: [_jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "N\u00FAmero:" }), " ", _jsx("span", { className: "font-mono font-semibold", children: selectedInvoice.invoiceNumber })] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Fecha:" }), " ", formatDateTime(selectedInvoice.issuedAt)] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Cliente:" }), " ", selectedInvoice.customer?.name ?? 'Consumidor Final'] }), _jsxs("div", { children: [_jsx("span", { className: "text-gray-500", children: "Estado:" }), " ", _jsx(Badge, { variant: statusVariant(selectedInvoice.status), children: invoiceStatusBadge(selectedInvoice.status).label })] }), selectedInvoice.cufe && _jsxs("div", { className: "col-span-2", children: [_jsx("span", { className: "text-gray-500", children: "CUFE:" }), " ", _jsx("span", { className: "font-mono text-xs break-all", children: selectedInvoice.cufe })] })] }), _jsx("div", { className: "overflow-x-auto", children: _jsxs("table", { className: "w-full text-sm", children: [_jsx("thead", { className: "bg-gray-50", children: _jsxs("tr", { children: [_jsx("th", { className: "table-th", children: "Producto" }), _jsx("th", { className: "table-th", children: "Cant." }), _jsx("th", { className: "table-th", children: "Precio" }), _jsx("th", { className: "table-th", children: "Subtotal" })] }) }), _jsx("tbody", { children: (selectedInvoice.items ?? []).map((item, i) => (_jsxs("tr", { className: "table-row", children: [_jsx("td", { className: "table-td", children: item.product?.name ?? item.productId }), _jsx("td", { className: "table-td", children: item.quantity }), _jsx("td", { className: "table-td", children: formatCOP(Number(item.unitPrice)) }), _jsx("td", { className: "table-td font-semibold", children: formatCOP(Number(item.subtotal ?? item.lineTotal ?? 0)) })] }, i))) })] }) }), _jsxs("div", { className: "flex justify-between items-start", children: [_jsxs("div", { className: "space-y-1 text-sm", children: [_jsxs("div", { className: "flex justify-between gap-8", children: [_jsx("span", { className: "text-gray-500", children: "Subtotal:" }), _jsx("span", { children: formatCOP(selectedInvoice.subtotal) })] }), _jsxs("div", { className: "flex justify-between gap-8", children: [_jsx("span", { className: "text-gray-500", children: "IVA:" }), _jsx("span", { children: formatCOP(selectedInvoice.taxTotal) })] }), _jsxs("div", { className: "flex justify-between gap-8 font-bold text-base", children: [_jsx("span", { children: "Total:" }), _jsx("span", { className: "text-orange-500", children: formatCOP(selectedInvoice.total) })] })] }), selectedInvoice.qrData && (_jsx(QRCodeSVG, { value: selectedInvoice.qrData, size: 100 }))] })] })) }), _jsxs(Modal, { open: cancelDialog, onClose: () => { setCancelDialog(false); setCancelReason(''); }, title: "Anular Factura", size: "sm", footer: _jsxs("div", { className: "flex gap-2 justify-end", children: [_jsx("button", { className: "btn-outline", onClick: () => { setCancelDialog(false); setCancelReason(''); }, children: "Cancelar" }), _jsxs("button", { className: "btn-destructive", onClick: handleCancel, disabled: cancelLoading || !cancelReason.trim(), children: [cancelLoading && _jsx(Spinner, { size: "sm" }), " Anular"] })] }), children: [_jsxs("p", { className: "text-sm text-gray-600 mb-4", children: ["Indica el motivo de la anulaci\u00F3n de la factura ", _jsx("strong", { children: selectedInvoice?.invoiceNumber }), ":"] }), _jsx("textarea", { value: cancelReason, onChange: (e) => setCancelReason(e.target.value), className: "input-field resize-none", rows: 3, placeholder: "Motivo de anulaci\u00F3n..." })] })] }));
}
