import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { useState, useEffect, useCallback, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Edit, Trash2, SlidersHorizontal, Upload, Download, Package } from 'lucide-react';
import { toast } from 'sonner';
import { inventoryService } from '@/services/inventoryService';
import { productSchema, adjustStockSchema } from '@/utils/validators';
import { PageHeader } from '@/components/ui/PageHeader';
import { SearchInput } from '@/components/ui/SearchInput';
import { Modal } from '@/components/ui/Modal';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Badge } from '@/components/ui/Badge';
import { Pagination } from '@/components/ui/Pagination';
import { EmptyState } from '@/components/ui/EmptyState';
import { TableSkeleton } from '@/components/ui/Skeleton';
import { Spinner } from '@/components/ui/Spinner';
import { Card } from '@/components/ui/Card';
import { formatCOP, formatNumber } from '@/utils/formatters';
import { exportProductsToExcel } from '@/utils/excelExport';
import { debounce } from '@/utils/helpers';
const STOCK_TYPES = [
    { value: 'ENTRY', label: 'Entrada (Compra)' },
    { value: 'EXIT', label: 'Salida (Venta)' },
    { value: 'ADJUSTMENT', label: 'Ajuste Manual' },
    { value: 'RETURN', label: 'Devolución' },
];
export default function Inventory() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [loading, setLoading] = useState(true);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('');
    const [lowStockFilter, setLowStockFilter] = useState(false);
    const [productModal, setProductModal] = useState(false);
    const [stockModal, setStockModal] = useState(false);
    const [deleteDialog, setDeleteDialog] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [saving, setSaving] = useState(false);
    const [deleting, setDeleting] = useState(false);
    const importRef = useRef(null);
    const LIMIT = 25;
    const { register, handleSubmit, reset, formState: { errors } } = useForm({
        resolver: zodResolver(productSchema),
        defaultValues: { taxRate: 19, stock: 0, minStock: 5 },
    });
    const { register: regStock, handleSubmit: handleStockSubmit, reset: resetStock, formState: { errors: stockErrors } } = useForm({
        resolver: zodResolver(adjustStockSchema),
        defaultValues: { type: 'ENTRY' },
    });
    const load = useCallback(async (q = search, cat = categoryFilter, ls = lowStockFilter, p = page) => {
        setLoading(true);
        try {
            const res = await inventoryService.getProducts({ page: p, limit: LIMIT, search: q || undefined, categoryId: cat || undefined, lowStock: ls || undefined });
            setProducts(res.data);
            setTotal(res.total);
            setTotalPages(res.totalPages);
        }
        catch { /* handled */ }
        finally {
            setLoading(false);
        }
    }, []); // eslint-disable-line react-hooks/exhaustive-deps
    const debouncedLoad = useCallback(debounce((q) => {
        setPage(1);
        load(q, categoryFilter, lowStockFilter, 1);
    }, 350), [categoryFilter, lowStockFilter, load]);
    useEffect(() => { load(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
    useEffect(() => { inventoryService.getCategories().then(setCategories).catch(() => { }); }, []);
    const handleSearch = (v) => { setSearch(v); debouncedLoad(v); };
    const handleFilterChange = (cat, ls) => {
        setCategoryFilter(cat);
        setLowStockFilter(ls);
        setPage(1);
        load(search, cat, ls, 1);
    };
    const openCreate = () => {
        setSelectedProduct(null);
        reset({ taxRate: 19, stock: 0, minStock: 5 });
        setProductModal(true);
    };
    const openEdit = (p) => {
        setSelectedProduct(p);
        reset({
            name: p.name, sku: p.sku, barcode: p.barcode, category: p.category?.name ?? '',
            brandId: p.brandId, costPrice: p.costPrice, salePrice: p.salePrice,
            taxRate: p.taxRate, stock: p.stock, minStock: p.minStock,
            binLocation: p.binLocation, description: p.description,
        });
        setProductModal(true);
    };
    const openStockAdjust = (p) => {
        setSelectedProduct(p);
        resetStock({ type: 'ENTRY', quantity: undefined, reason: '' });
        setStockModal(true);
    };
    const onSaveProduct = async (data) => {
        setSaving(true);
        try {
            // Resolve free-text category name → categoryId
            const categoryName = data.category.trim();
            let categoryId;
            const existing = categories.find((c) => c.name.toLowerCase() === categoryName.toLowerCase());
            if (existing) {
                categoryId = existing.id;
            }
            else {
                const codePrefix = categoryName
                    .toUpperCase()
                    .replace(/[^A-Z0-9]/g, '')
                    .substring(0, 6)
                    .padEnd(2, 'X');
                const newCat = await inventoryService.createFullCategory({ name: categoryName, codePrefix });
                categoryId = newCat.id;
                setCategories((prev) => [...prev, newCat]);
            }
            const { category: _cat, ...formData } = data;
            const payload = { ...formData, categoryId };
            if (selectedProduct) {
                const updated = await inventoryService.updateProduct(selectedProduct.id, payload);
                setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
                toast.success('Producto actualizado');
            }
            else {
                await inventoryService.createProduct(payload);
                toast.success('Producto creado');
                load(search, categoryFilter, lowStockFilter, 1);
                setPage(1);
            }
            setProductModal(false);
        }
        catch (err) {
            const msg = err?.response?.data?.message ?? 'Error al guardar producto';
            toast.error(msg);
        }
        finally {
            setSaving(false);
        }
    };
    const onAdjustStock = async (data) => {
        if (!selectedProduct)
            return;
        setSaving(true);
        try {
            await inventoryService.adjustStock(selectedProduct.id, data);
            toast.success('Stock actualizado correctamente');
            setStockModal(false);
            load(search, categoryFilter, lowStockFilter, page);
        }
        catch (err) {
            const msg = err?.response?.data?.message ?? 'Error al ajustar stock';
            toast.error(msg);
        }
        finally {
            setSaving(false);
        }
    };
    const onDelete = async () => {
        if (!selectedProduct)
            return;
        setDeleting(true);
        try {
            await inventoryService.deleteProduct(selectedProduct.id);
            toast.success('Producto eliminado');
            setDeleteDialog(false);
            load(search, categoryFilter, lowStockFilter, page);
        }
        catch (err) {
            const msg = err?.response?.data?.message ?? 'Error al eliminar';
            toast.error(msg);
        }
        finally {
            setDeleting(false);
        }
    };
    const handleExport = async () => {
        if (products.length === 0) {
            toast.warning('No hay productos para exportar');
            return;
        }
        try {
            await exportProductsToExcel(products);
            toast.success('Excel exportado correctamente');
        }
        catch {
            toast.error('Error al exportar');
        }
    };
    const handleImport = async (e) => {
        const file = e.target.files?.[0];
        if (!file)
            return;
        try {
            const res = await inventoryService.importFromExcel(file);
            toast.success(`${res.imported} productos importados`);
            if (res.errors?.length)
                toast.warning(`${res.errors.length} registros con errores`);
            load(search, categoryFilter, lowStockFilter, 1);
        }
        catch {
            toast.error('Error al importar Excel');
        }
        finally {
            e.target.value = '';
        }
    };
    const stockBadge = (p) => {
        if (p.stock <= 0)
            return _jsx(Badge, { variant: "red", children: p.stock });
        if (p.stock <= (p.minStock ?? 5))
            return _jsx(Badge, { variant: "yellow", children: p.stock });
        return _jsx(Badge, { variant: "green", children: p.stock });
    };
    return (_jsxs("div", { children: [_jsx(PageHeader, { title: "Inventario", description: "Gesti\u00F3n de productos y stock", actions: _jsxs("div", { className: "flex gap-2", children: [_jsx("input", { ref: importRef, type: "file", accept: ".xlsx,.xls,.csv", className: "hidden", onChange: handleImport }), _jsxs("button", { className: "btn-outline btn-sm", onClick: () => importRef.current?.click(), children: [_jsx(Upload, { className: "w-4 h-4" }), " Importar"] }), _jsxs("button", { className: "btn-outline btn-sm", onClick: handleExport, children: [_jsx(Download, { className: "w-4 h-4" }), " Exportar"] }), _jsxs("button", { className: "btn-primary btn-sm", onClick: openCreate, children: [_jsx(Plus, { className: "w-4 h-4" }), " Agregar Producto"] })] }) }), _jsx(Card, { className: "mb-4 p-4", children: _jsxs("div", { className: "flex flex-wrap gap-3 items-center", children: [_jsx(SearchInput, { value: search, onChange: handleSearch, placeholder: "Buscar por nombre o SKU...", className: "w-72" }), _jsxs("select", { className: "input-field w-48", value: categoryFilter, onChange: (e) => handleFilterChange(e.target.value, lowStockFilter), children: [_jsx("option", { value: "", children: "Todas las categor\u00EDas" }), categories.map((c) => _jsx("option", { value: c.id, children: c.name }, c.id))] }), _jsxs("label", { className: "flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none", children: [_jsx("input", { type: "checkbox", checked: lowStockFilter, onChange: (e) => handleFilterChange(categoryFilter, e.target.checked), className: "w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400" }), _jsx(SlidersHorizontal, { className: "w-4 h-4" }), "Solo bajo stock"] }), (search || categoryFilter || lowStockFilter) && (_jsx("button", { className: "btn-ghost btn-sm text-gray-500", onClick: () => { setSearch(''); setCategoryFilter(''); setLowStockFilter(false); load('', '', false, 1); setPage(1); }, children: "Limpiar filtros" }))] }) }), _jsxs(Card, { className: "overflow-hidden", children: [_jsx("div", { className: "overflow-x-auto", children: loading ? (_jsx(TableSkeleton, { rows: 8, cols: 7 })) : products.length === 0 ? (_jsx(EmptyState, { icon: _jsx(Package, { className: "w-8 h-8" }), title: "Sin productos", description: "No se encontraron productos con los filtros aplicados.", action: _jsxs("button", { className: "btn-primary btn-sm", onClick: openCreate, children: [_jsx(Plus, { className: "w-4 h-4" }), " Agregar primero"] }) })) : (_jsxs("table", { className: "w-full", children: [_jsx("thead", { children: _jsxs("tr", { className: "bg-gray-50 border-b border-gray-200", children: [_jsx("th", { className: "table-th", children: "SKU" }), _jsx("th", { className: "table-th", children: "Nombre" }), _jsx("th", { className: "table-th", children: "Categor\u00EDa" }), _jsx("th", { className: "table-th", children: "Precio Venta" }), _jsx("th", { className: "table-th", children: "Costo" }), _jsx("th", { className: "table-th", children: "Stock" }), _jsx("th", { className: "table-th", children: "Ubicaci\u00F3n" }), _jsx("th", { className: "table-th", children: "Acciones" })] }) }), _jsx("tbody", { children: products.map((p) => (_jsxs("tr", { className: "table-row", children: [_jsx("td", { className: "table-td font-mono text-xs text-gray-500", children: p.sku || '—' }), _jsx("td", { className: "table-td", children: _jsxs("div", { children: [_jsx("p", { className: "font-medium text-gray-900 text-sm", children: p.name }), p.barcode && _jsx("p", { className: "text-xs text-gray-400", children: p.barcode })] }) }), _jsx("td", { className: "table-td text-gray-500", children: p.category?.name ?? '—' }), _jsx("td", { className: "table-td font-semibold text-gray-900", children: formatCOP(p.salePrice) }), _jsx("td", { className: "table-td text-gray-500", children: formatCOP(p.costPrice) }), _jsx("td", { className: "table-td", children: stockBadge(p) }), _jsx("td", { className: "table-td text-gray-500 text-xs", children: p.binLocation || '—' }), _jsx("td", { className: "table-td", children: _jsxs("div", { className: "flex items-center gap-1", children: [_jsx("button", { onClick: () => openStockAdjust(p), className: "p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors", title: "Ajustar stock", children: _jsx(SlidersHorizontal, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => openEdit(p), className: "p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors", title: "Editar", children: _jsx(Edit, { className: "w-4 h-4" }) }), _jsx("button", { onClick: () => { setSelectedProduct(p); setDeleteDialog(true); }, className: "p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors", title: "Eliminar", children: _jsx(Trash2, { className: "w-4 h-4" }) })] }) })] }, p.id))) })] })) }), !loading && products.length > 0 && (_jsx(Pagination, { page: page, totalPages: totalPages, total: total, limit: LIMIT, onPageChange: (p) => { setPage(p); load(search, categoryFilter, lowStockFilter, p); } }))] }), _jsx(Modal, { open: productModal, onClose: () => setProductModal(false), title: selectedProduct ? 'Editar Producto' : 'Nuevo Producto', size: "lg", footer: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { className: "btn-outline", onClick: () => setProductModal(false), children: "Cancelar" }), _jsxs("button", { className: "btn-primary", form: "product-form", type: "submit", disabled: saving, children: [saving && _jsx(Spinner, { size: "sm" }), " ", selectedProduct ? 'Actualizar' : 'Crear Producto'] })] }), children: _jsxs("form", { id: "product-form", onSubmit: handleSubmit(onSaveProduct), className: "grid grid-cols-2 gap-4", children: [_jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: "label", children: "Nombre del Producto *" }), _jsx("input", { className: `input-field ${errors.name ? 'input-error' : ''}`, ...register('name'), placeholder: "Ej: Aceite motor 4T 20W50 1L" }), errors.name && _jsx("p", { className: "text-red-500 text-xs mt-1", children: errors.name.message })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "SKU Interno" }), _jsx("input", { className: "input-field", ...register('sku'), placeholder: "Ej: ACE-4T-001" })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "C\u00F3digo de Barras" }), _jsx("input", { className: "input-field", ...register('barcode'), placeholder: "EAN-13 o UPC-A" })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Categor\u00EDa *" }), _jsx("input", { className: `input-field ${errors.category ? 'input-error' : ''}`, ...register('category'), placeholder: "Ej: Aceites, Filtros, Frenos..." }), errors.category && _jsx("p", { className: "text-red-500 text-xs mt-1", children: errors.category.message })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Ubicaci\u00F3n (Bin)" }), _jsx("input", { className: "input-field", ...register('binLocation'), placeholder: "Ej: A-12-3" })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Precio Costo *" }), _jsx("input", { type: "number", step: "1", min: "0", className: `input-field ${errors.costPrice ? 'input-error' : ''}`, ...register('costPrice', { valueAsNumber: true }), placeholder: "0" }), errors.costPrice && _jsx("p", { className: "text-red-500 text-xs mt-1", children: errors.costPrice.message })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Precio Venta *" }), _jsx("input", { type: "number", step: "1", min: "0", className: `input-field ${errors.salePrice ? 'input-error' : ''}`, ...register('salePrice', { valueAsNumber: true }), placeholder: "0" }), errors.salePrice && _jsx("p", { className: "text-red-500 text-xs mt-1", children: errors.salePrice.message })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "IVA (%)" }), _jsx("input", { type: "number", step: "1", min: "0", max: "100", className: "input-field", ...register('taxRate', { valueAsNumber: true }), defaultValue: 19 })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Stock Inicial" }), _jsx("input", { type: "number", step: "1", min: "0", className: "input-field", ...register('stock', { valueAsNumber: true }) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Stock M\u00EDnimo" }), _jsx("input", { type: "number", step: "1", min: "0", className: "input-field", ...register('minStock', { valueAsNumber: true }) })] }), _jsxs("div", { className: "col-span-2", children: [_jsx("label", { className: "label", children: "Descripci\u00F3n" }), _jsx("textarea", { className: "input-field resize-none", rows: 2, ...register('description'), placeholder: "Descripci\u00F3n opcional..." })] })] }) }), _jsx(Modal, { open: stockModal, onClose: () => setStockModal(false), title: `Ajustar Stock — ${selectedProduct?.name ?? ''}`, size: "sm", footer: _jsxs("div", { className: "flex justify-end gap-2", children: [_jsx("button", { className: "btn-outline", onClick: () => setStockModal(false), children: "Cancelar" }), _jsxs("button", { className: "btn-secondary", form: "stock-form", type: "submit", disabled: saving, children: [saving && _jsx(Spinner, { size: "sm" }), " Aplicar Ajuste"] })] }), children: _jsxs("form", { id: "stock-form", onSubmit: handleStockSubmit(onAdjustStock), className: "space-y-4", children: [_jsxs("div", { className: "bg-gray-50 rounded-lg p-3 text-sm", children: [_jsx("span", { className: "text-gray-500", children: "Stock actual: " }), _jsxs("span", { className: "font-bold text-gray-900", children: [formatNumber(selectedProduct?.stock ?? 0), " unidades"] })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Tipo de Movimiento *" }), _jsx("select", { className: "input-field", ...regStock('type'), children: STOCK_TYPES.map((t) => _jsx("option", { value: t.value, children: t.label }, t.value)) })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Cantidad *" }), _jsx("input", { type: "number", step: "1", min: "1", className: `input-field ${stockErrors.quantity ? 'input-error' : ''}`, ...regStock('quantity', { valueAsNumber: true }), placeholder: "0" }), stockErrors.quantity && _jsx("p", { className: "text-red-500 text-xs mt-1", children: stockErrors.quantity.message })] }), _jsxs("div", { children: [_jsx("label", { className: "label", children: "Motivo *" }), _jsx("input", { className: `input-field ${stockErrors.reason ? 'input-error' : ''}`, ...regStock('reason'), placeholder: "Ej: Compra a proveedor XYZ" }), stockErrors.reason && _jsx("p", { className: "text-red-500 text-xs mt-1", children: stockErrors.reason.message })] })] }) }), _jsx(ConfirmDialog, { open: deleteDialog, title: "Eliminar Producto", message: `¿Seguro que deseas eliminar "${selectedProduct?.name}"? Esta acción no se puede deshacer.`, confirmLabel: "S\u00ED, Eliminar", loading: deleting, onConfirm: onDelete, onCancel: () => setDeleteDialog(false) })] }));
}
