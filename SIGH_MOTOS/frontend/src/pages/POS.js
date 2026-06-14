import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
import { useState, useRef, useEffect, useCallback } from 'react';
import { Plus, Minus, Trash2, User, Receipt, Printer, Download, X, Ticket } from 'lucide-react';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { posService } from '@/services/posService';
import { Card } from '@/components/ui/Card';
import { SearchInput } from '@/components/ui/SearchInput';
import { Modal } from '@/components/ui/Modal';
import { Spinner } from '@/components/ui/Spinner';
import { PageHeader } from '@/components/ui/PageHeader';
import { SmartScannerInput } from '@/components/SmartScannerInput';
import { formatCOP } from '@/utils/formatters';
import { generateInvoicePDF } from '@/utils/pdfGenerator';
const PAYMENT_METHODS = [
    { value: 'CASH', label: 'Efectivo' },
    { value: 'CARD', label: 'Tarjeta' },
    { value: 'TRANSFER', label: 'Transferencia' },
    { value: 'MIXED', label: 'Mixto' },
    { value: 'CREDIT', label: 'Crédito / Fiado' },
];
export default function POS() {
    const [cart, setCart] = useState([]);
    const [customer, setCustomer] = useState(null);
    const [customerSearch, setCustomerSearch] = useState('');
    const [customerResults, setCustomerResults] = useState([]);
    const [paymentMethod, setPaymentMethod] = useState('CASH');
    const [globalDiscount, setGlobalDiscount] = useState(0);
    const [notes, setNotes] = useState('');
    const [finalizingLoading, setFinalizingLoading] = useState(false);
    const [completedSale, setCompletedSale] = useState(null);
    const [receiptModal, setReceiptModal] = useState(false);
    const scannerRef = useRef(null);
    useEffect(() => {
        scannerRef.current?.focus();
        const onKey = (e) => {
            if (e.key === 'F1') {
                e.preventDefault();
                scannerRef.current?.focus();
            }
            if (e.key === 'F2') {
                e.preventDefault();
                if (cart.length > 0)
                    handleFinalize();
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [cart]); // eslint-disable-line react-hooks/exhaustive-deps
    const addToCart = (product) => {
        setCart((prev) => {
            const existing = prev.find((i) => i.productId === product.id);
            if (existing) {
                if (existing.quantity >= product.stock) {
                    toast.warning('No hay más stock disponible');
                    return prev;
                }
                return prev.map((i) => i.productId === product.id
                    ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice * (1 - i.discount / 100) }
                    : i);
            }
            return [...prev, {
                    productId: product.id,
                    product,
                    quantity: 1,
                    unitPrice: product.salePrice,
                    discount: 0,
                    subtotal: product.salePrice,
                }];
        });
    };
    const updateQty = (productId, qty) => {
        if (qty <= 0) {
            removeFromCart(productId);
            return;
        }
        setCart((prev) => prev.map((i) => {
            if (i.productId !== productId)
                return i;
            if (qty > i.product.stock) {
                toast.warning('Cantidad supera el stock disponible');
                return i;
            }
            return { ...i, quantity: qty, subtotal: qty * i.unitPrice * (1 - i.discount / 100) };
        }));
    };
    const updateDiscount = (productId, disc) => {
        const d = Math.max(0, Math.min(100, disc));
        setCart((prev) => prev.map((i) => i.productId !== productId ? i : { ...i, discount: d, subtotal: i.quantity * i.unitPrice * (1 - d / 100) }));
    };
    const removeFromCart = (productId) => setCart((prev) => prev.filter((i) => i.productId !== productId));
    const subtotal = cart.reduce((s, i) => s + i.subtotal, 0);
    const discountAmount = (subtotal * globalDiscount) / 100;
    const taxableBase = subtotal - discountAmount;
    const taxTotal = taxableBase * 0.19;
    const total = taxableBase + taxTotal;
    const handleFinalize = useCallback(async () => {
        if (cart.length === 0) {
            toast.error('El carrito está vacío');
            return;
        }
        setFinalizingLoading(true);
        try {
            const sale = await posService.createSale({
                customerId: customer?.id,
                items: cart.map((i) => ({ productId: i.productId, quantity: i.quantity, unitPrice: i.unitPrice, discountPerItem: i.discount })),
                paymentMethod,
                discountAmount,
                notes: notes || undefined,
            });
            setCompletedSale(sale);
            setReceiptModal(true);
            setCart([]);
            setCustomer(null);
            setNotes('');
            setGlobalDiscount(0);
            toast.success(`Venta ${sale.saleNumber} completada exitosamente`);
        }
        catch (err) {
            const msg = err?.response?.data?.message ?? 'Error al procesar la venta';
            toast.error(msg);
        }
        finally {
            setFinalizingLoading(false);
        }
    }, [cart, customer, paymentMethod, discountAmount, notes]);
    const searchCustomers = useCallback(async (q) => {
        if (q.length < 2) {
            setCustomerResults([]);
            return;
        }
        try {
            const results = await posService.searchCustomers(q);
            setCustomerResults(results);
        }
        catch {
            setCustomerResults([]);
        }
    }, []);
    useEffect(() => {
        const t = setTimeout(() => searchCustomers(customerSearch), 350);
        return () => clearTimeout(t);
    }, [customerSearch, searchCustomers]);
    const handlePrintPDF = () => {
        if (!completedSale?.invoiceId) {
            toast.warning('La factura aún no está disponible');
            return;
        }
        // Use the invoice data from the sale
        const fakeInvoice = {
            id: completedSale.invoiceId ?? '',
            invoiceNumber: completedSale.saleNumber,
            issuedAt: completedSale.createdAt,
            createdAt: completedSale.createdAt,
            customer: completedSale.customer,
            items: completedSale.items,
            subtotal: Number(completedSale.subtotal ?? 0),
            taxTotal: Number(completedSale.taxTotal ?? 0),
            total: Number(completedSale.total ?? 0),
            status: 'EMITIDA',
        };
        generateInvoicePDF(fakeInvoice);
    };
    return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Punto de Venta", description: "F1: Buscar  \u00B7  F2: Finalizar Venta  \u00B7  ESC: Limpiar" }), _jsxs("div", { className: "grid grid-cols-1 xl:grid-cols-5 gap-4", children: [_jsxs("div", { className: "xl:col-span-3 space-y-4", children: [_jsx(SmartScannerInput, { ref: scannerRef, onProductScanned: addToCart, disabled: finalizingLoading }), _jsxs(Card, { className: "overflow-hidden", children: [_jsxs("div", { className: "px-4 py-3 border-b border-gray-100 flex items-center justify-between", children: [_jsxs("h3", { className: "font-semibold text-gray-800", children: ["Carrito (", cart.length, " productos)"] }), cart.length > 0 && (_jsx("button", { className: "text-sm text-red-500 hover:text-red-700", onClick: () => setCart([]), children: "Vaciar carrito" }))] }), cart.length === 0 ? (_jsxs("div", { className: "py-16 text-center text-gray-400 text-sm", children: [_jsx(Receipt, { className: "w-10 h-10 mx-auto mb-2 text-gray-200" }), "El carrito est\u00E1 vac\u00EDo. Escanea o busca un producto."] })) : (_jsx("div", { className: "divide-y divide-gray-50", children: cart.map((item) => (_jsx("div", { className: "px-4 py-3 hover:bg-gray-50 transition-colors", children: _jsxs("div", { className: "flex items-start justify-between gap-2", children: [_jsxs("div", { className: "flex-1 min-w-0", children: [_jsx("p", { className: "font-medium text-sm text-gray-900 truncate", children: item.product.name }), _jsx("p", { className: "text-xs text-gray-400", children: item.product.sku }), _jsxs("p", { className: "text-xs text-blue-700 font-medium mt-0.5", children: [formatCOP(item.unitPrice), " c/u"] })] }), _jsxs("div", { className: "flex items-center gap-2 flex-shrink-0", children: [_jsxs("div", { className: "flex items-center border border-gray-200 rounded-lg overflow-hidden", children: [_jsx("button", { onClick: () => updateQty(item.productId, item.quantity - 1), className: "p-1.5 hover:bg-gray-100 text-gray-500", children: _jsx(Minus, { className: "w-3 h-3" }) }), _jsx("input", { type: "number", min: "1", value: item.quantity, onChange: (e) => updateQty(item.productId, Number(e.target.value)), className: "w-12 text-center text-sm border-0 focus:outline-none py-1" }), _jsx("button", { onClick: () => updateQty(item.productId, item.quantity + 1), className: "p-1.5 hover:bg-gray-100 text-gray-500", children: _jsx(Plus, { className: "w-3 h-3" }) })] }), _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("input", { type: "number", min: "0", max: "100", value: item.discount, onChange: (e) => updateDiscount(item.productId, Number(e.target.value)), className: "w-14 text-center text-sm border border-gray-200 rounded py-1 focus:outline-none focus:border-blue-400", title: "Descuento %", placeholder: "%" }), _jsx("span", { className: "text-xs text-gray-400", children: "%" })] }), _jsx("p", { className: "font-semibold text-sm w-24 text-right", children: formatCOP(item.subtotal) }), _jsx("button", { onClick: () => removeFromCart(item.productId), className: "p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded", children: _jsx(Trash2, { className: "w-4 h-4" }) })] })] }) }, item.productId))) }))] })] }), _jsxs("div", { className: "xl:col-span-2 space-y-4", children: [_jsxs(Card, { className: "p-4", children: [_jsxs("label", { className: "label", children: [_jsx(User, { className: "inline w-4 h-4 mr-1 text-gray-400" }), "Cliente (opcional)"] }), customer ? (_jsxs("div", { className: "flex items-center justify-between bg-blue-50 rounded-lg px-3 py-2", children: [_jsxs("div", { children: [_jsx("p", { className: "font-medium text-sm text-blue-900", children: customer.name }), _jsx("p", { className: "text-xs text-blue-600", children: customer.phone ?? customer.email ?? customer.documentNumber ?? '' })] }), _jsx("button", { onClick: () => setCustomer(null), className: "text-blue-400 hover:text-blue-600", children: _jsx(X, { className: "w-4 h-4" }) })] })) : (_jsxs("div", { className: "relative", children: [_jsx(SearchInput, { value: customerSearch, onChange: setCustomerSearch, placeholder: "Buscar cliente..." }), customerResults.length > 0 && (_jsx("div", { className: "absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1 max-h-48 overflow-y-auto", children: customerResults.map((c) => (_jsxs("button", { onClick: () => { setCustomer(c); setCustomerSearch(''); setCustomerResults([]); }, className: "w-full text-left px-3 py-2 hover:bg-gray-50 text-sm", children: [_jsx("p", { className: "font-medium", children: c.name }), _jsx("p", { className: "text-gray-400 text-xs", children: c.phone ?? c.email })] }, c.id))) }))] }))] }), _jsxs(Card, { className: "p-4 space-y-4", children: [_jsxs("div", { children: [_jsx("label", { className: "label", children: "M\u00E9todo de Pago" }), _jsx("select", { className: "input-field", value: paymentMethod, onChange: (e) => setPaymentMethod(e.target.value), children: PAYMENT_METHODS.map((m) => _jsx("option", { value: m.value, children: m.label }, m.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Descuento Global (%)" }), _jsx("input", { type: "number", min: "0", max: "100", value: globalDiscount, onChange: (e) => setGlobalDiscount(Math.max(0, Math.min(100, Number(e.target.value)))), className: "input-field" })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Notas" }), _jsx("textarea", { rows: 2, value: notes, onChange: (e) => setNotes(e.target.value), className: "input-field resize-none", placeholder: "Notas opcionales..." })] })] }), _jsxs(Card, { className: "p-4", children: [_jsxs("div", { className: "space-y-2 text-sm", children: [_jsxs("div", { className: "flex justify-between text-gray-600", children: [_jsx("span", { children: "Subtotal" }), _jsx("span", { children: formatCOP(subtotal) })] }), globalDiscount > 0 && (_jsxs("div", { className: "flex justify-between text-orange-600", children: [_jsxs("span", { children: ["Descuento (", globalDiscount, "%)"] }), _jsxs("span", { children: ["-", formatCOP(discountAmount)] })] })), _jsxs("div", { className: "flex justify-between text-gray-600", children: [_jsx("span", { children: "IVA (19%)" }), _jsx("span", { children: formatCOP(taxTotal) })] }), _jsxs("div", { className: "flex justify-between text-lg font-bold text-gray-900 pt-2 border-t border-gray-100", children: [_jsx("span", { children: "TOTAL" }), _jsx("span", { className: "text-orange-500", children: formatCOP(total) })] })] }), _jsx("button", { onClick: handleFinalize, disabled: cart.length === 0 || finalizingLoading, className: "btn-primary w-full justify-center mt-4 py-3 text-base", children: finalizingLoading ? _jsxs(_Fragment, { children: [_jsx(Spinner, { size: "sm" }), " Procesando..."] }) : _jsxs(_Fragment, { children: [_jsx(Receipt, { className: "w-5 h-5" }), " Finalizar Venta (F2)"] }) })] })] })] }), _jsx(Modal, { open: receiptModal, onClose: () => setReceiptModal(false), title: "Venta Completada", size: "md", footer: _jsxs("div", { className: "flex gap-2 justify-end flex-wrap", children: [_jsx("button", { className: "btn-outline", onClick: () => { setReceiptModal(false); scannerRef.current?.focus(); }, children: "Nueva Venta" }), completedSale && (_jsxs("button", { className: "btn-secondary flex items-center gap-1", onClick: () => window.open(`/print-ticket/${completedSale.id}`, '_blank', 'width=400,height=700'), children: [_jsx(Ticket, { className: "w-4 h-4" }), " Ticket T\u00E9rmico"] })), _jsxs("button", { className: "btn-ghost", onClick: () => window.print(), children: [_jsx(Printer, { className: "w-4 h-4" }), " Imprimir"] }), _jsxs("button", { className: "btn-primary", onClick: handlePrintPDF, children: [_jsx(Download, { className: "w-4 h-4" }), " Descargar PDF"] })] }), children: completedSale && (_jsxs("div", { className: "text-center space-y-4", children: [_jsx("div", { className: "w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto", children: _jsx(Receipt, { className: "w-8 h-8 text-green-600" }) }), _jsxs("div", { children: [_jsx("p", { className: "text-2xl font-bold text-gray-900", children: formatCOP(Number(completedSale.totalAmount ?? completedSale.total ?? 0)) }), _jsxs("p", { className: "text-sm text-gray-500", children: ["Factura ", completedSale.saleNumber] })] }), completedSale.invoiceId && (_jsx("div", { className: "flex justify-center", children: _jsx(QRCodeSVG, { value: `https://motos.quantacloud.com/invoices/${completedSale.invoiceId}`, size: 120 }) })), _jsxs("div", { className: "text-left bg-gray-50 rounded-xl p-4 space-y-2", children: [completedSale.items.slice(0, 5).map((item, i) => (_jsxs("div", { className: "flex justify-between text-sm", children: [_jsxs("span", { className: "text-gray-600", children: [item.productNameSnapshot ?? item.product?.name ?? 'Producto', " \u00D7 ", item.quantity] }), _jsx("span", { className: "font-medium", children: formatCOP(Number(item.lineTotal ?? item.subtotal ?? 0)) })] }, i))), completedSale.items.length > 5 && (_jsxs("p", { className: "text-xs text-gray-400 text-center", children: ["+", completedSale.items.length - 5, " m\u00E1s..."] })), _jsxs("div", { className: "border-t border-gray-200 pt-2 flex justify-between font-bold", children: [_jsx("span", { children: "Total" }), _jsx("span", { className: "text-orange-500", children: formatCOP(Number(completedSale.totalAmount ?? completedSale.total ?? 0)) })] })] })] })) })] }));
}
