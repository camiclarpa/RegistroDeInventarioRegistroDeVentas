#!/bin/bash
set -euo pipefail

cd /opt/SIGH_MOTOS

echo "=========================================="
echo "🚀 DESPLIEGUE MÓDULO DE CATEGORÍAS"
echo "=========================================="
echo "Fecha: $(date)"
echo ""

# ==========================================
# 1. RESPALDAR ARCHIVOS ACTUALES
# ==========================================
echo "📦 1. Creando respaldos..."
mkdir -p /tmp/backup_sigh_motos_$(date +%Y%m%d_%H%M%S)
cp frontend/src/pages/Inventory.tsx /tmp/backup_sigh_motos_*/Inventory.tsx.backup 2>/dev/null || true
cp frontend/src/services/inventoryService.ts /tmp/backup_sigh_motos_*/inventoryService.ts.backup 2>/dev/null || true
echo "✅ Respaldo creado en /tmp/backup_sigh_motos_*/"

# ==========================================
# 2. ACTUALIZAR FRONTEND - Inventory.tsx
# ==========================================
echo ""
echo "🔧 2. Actualizando Inventory.tsx..."

cat > frontend/src/pages/Inventory.tsx << 'INVENTORY_EOF'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Plus, Edit, Trash2, SlidersHorizontal, Upload, Download, Package, Tag } from 'lucide-react'
import { toast } from 'sonner'
import { inventoryService } from '@/services/inventoryService'
import type { Product, Category } from '@/types'
import { productSchema, adjustStockSchema, type ProductInput, type AdjustStockInput } from '@/utils/validators'
import { PageHeader } from '@/components/ui/PageHeader'
import { SearchInput } from '@/components/ui/SearchInput'
import { Modal } from '@/components/ui/Modal'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'
import { Badge } from '@/components/ui/Badge'
import { Pagination } from '@/components/ui/Pagination'
import { EmptyState } from '@/components/ui/EmptyState'
import { TableSkeleton } from '@/components/ui/Skeleton'
import { Spinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/Card'
import { formatCOP, formatNumber } from '@/utils/formatters'
import { exportProductsToExcel } from '@/utils/excelExport'
import { debounce } from '@/utils/helpers'

const STOCK_TYPES = [
  { value: 'ENTRY', label: 'Entrada (Compra)' },
  { value: 'EXIT', label: 'Salida (Venta)' },
  { value: 'ADJUSTMENT', label: 'Ajuste Manual' },
  { value: 'RETURN', label: 'Devolución' },
]

export default function Inventory() {
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [lowStockFilter, setLowStockFilter] = useState(false)

  const [productModal, setProductModal] = useState(false)
  const [stockModal, setStockModal] = useState(false)
  const [deleteDialog, setDeleteDialog] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const importRef = useRef<HTMLInputElement>(null)

  // Gestionar Categorías
  const [catModal, setCatModal]     = useState(false)
  const [catStats, setCatStats]     = useState<Array<{ id: string; name: string; slug: string; codePrefix: string; activeProducts: number }>>([])
  const [loadingCats, setLoadingCats]   = useState(false)
  const [deletingCatId, setDeletingCatId] = useState<string | null>(null)

  const LIMIT = 25

  const { register, handleSubmit, reset, formState: { errors } } = useForm<ProductInput>({
    resolver: zodResolver(productSchema),
    defaultValues: { taxRate: 19, stock: 0, minStock: 5 },
  })

  const { register: regStock, handleSubmit: handleStockSubmit, reset: resetStock, formState: { errors: stockErrors } } = useForm<AdjustStockInput>({
    resolver: zodResolver(adjustStockSchema),
    defaultValues: { type: 'ENTRY' },
  })

  const load = useCallback(async (q = search, cat = categoryFilter, ls = lowStockFilter, p = page) => {
    setLoading(true)
    try {
      const res = await inventoryService.getProducts({ page: p, limit: LIMIT, search: q || undefined, categoryId: cat || undefined, lowStock: ls || undefined })
      setProducts(res.data)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch { /* handled */ } finally {
      setLoading(false)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const debouncedLoad = useCallback(debounce((q: string) => {
    setPage(1)
    load(q, categoryFilter, lowStockFilter, 1)
  }, 350) as (q: string) => void, [categoryFilter, lowStockFilter, load])

  useEffect(() => { load() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { inventoryService.getCategories().then(setCategories).catch(() => {}) }, [])

  const handleSearch = (v: string) => { setSearch(v); debouncedLoad(v) }

  const handleFilterChange = (cat: string, ls: boolean) => {
    setCategoryFilter(cat); setLowStockFilter(ls); setPage(1)
    load(search, cat, ls, 1)
  }

  const openCreate = () => {
    setSelectedProduct(null)
    reset({ taxRate: 19, stock: 0, minStock: 5 })
    setProductModal(true)
  }

  const openEdit = (p: Product) => {
    setSelectedProduct(p)
    reset({
      name: p.name, sku: p.sku, barcode: p.barcode, category: p.category?.name ?? '',
      brandId: p.brandId, costPrice: p.costPrice, salePrice: p.salePrice,
      taxRate: p.taxRate, stock: p.stock, minStock: p.minStock,
      binLocation: p.binLocation, description: p.description,
    })
    setProductModal(true)
  }

  const openStockAdjust = (p: Product) => {
    setSelectedProduct(p)
    resetStock({ type: 'ENTRY', quantity: undefined as unknown as number, reason: '' })
    setStockModal(true)
  }

  const onSaveProduct = async (data: ProductInput) => {
    setSaving(true)
    try {
      // Resolve free-text category name → categoryId
      const categoryName = data.category.trim()
      let categoryId: string
      const existing = categories.find(
        (c) => c.name.toLowerCase() === categoryName.toLowerCase()
      )
      if (existing) {
        categoryId = existing.id
      } else {
        const codePrefix = categoryName
          .toUpperCase()
          .replace(/[^A-Z0-9]/g, '')
          .substring(0, 6)
          .padEnd(2, 'X')
        const newCat = await inventoryService.createFullCategory({ name: categoryName, codePrefix })
        categoryId = newCat.id
        setCategories((prev) => [...prev, newCat])
      }

      const { category: _cat, ...formData } = data
      const payload = { ...formData, categoryId }

      if (selectedProduct) {
        const updated = await inventoryService.updateProduct(selectedProduct.id, payload)
        setProducts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
        toast.success('Producto actualizado')
      } else {
        await inventoryService.createProduct(payload)
        toast.success('Producto creado')
        load(search, categoryFilter, lowStockFilter, 1)
        setPage(1)
      }
      setProductModal(false)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al guardar producto'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const onAdjustStock = async (data: AdjustStockInput) => {
    if (!selectedProduct) return
    setSaving(true)
    try {
      await inventoryService.adjustStock(selectedProduct.id, data)
      toast.success('Stock actualizado correctamente')
      setStockModal(false)
      load(search, categoryFilter, lowStockFilter, page)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al ajustar stock'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const onDelete = async () => {
    if (!selectedProduct) return
    setDeleting(true)
    try {
      await inventoryService.deleteProduct(selectedProduct.id)
      toast.success('Producto eliminado')
      setDeleteDialog(false)
      load(search, categoryFilter, lowStockFilter, page)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al eliminar'
      toast.error(msg)
    } finally {
      setDeleting(false)
    }
  }

  const handleExport = async () => {
    if (products.length === 0) { toast.warning('No hay productos para exportar'); return }
    try {
      await exportProductsToExcel(products)
      toast.success('Excel exportado correctamente')
    } catch { toast.error('Error al exportar') }
  }

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const res = await inventoryService.importFromExcel(file)
      toast.success(`${res.imported} productos importados`)
      if (res.errors?.length) toast.warning(`${res.errors.length} registros con errores`)
      load(search, categoryFilter, lowStockFilter, 1)
    } catch { toast.error('Error al importar Excel') } finally {
      e.target.value = ''
    }
  }

  const openCatModal = async () => {
    setCatModal(true)
    setLoadingCats(true)
    try {
      const stats = await inventoryService.getCategoriesStats()
      setCatStats(stats)
    } catch {
      toast.error('Error al cargar categorías')
    } finally {
      setLoadingCats(false)
    }
  }

  const handleDeleteCategory = async (id: string, name: string) => {
    setDeletingCatId(id)
    try {
      await inventoryService.deleteCategory(id)
      toast.success(`Categoría "${name}" eliminada`)
      setCatStats(prev => prev.filter(c => c.id !== id))
      setCategories(prev => prev.filter(c => c.id !== id))
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? 'Error al eliminar categoría'
      toast.error(msg)
    } finally {
      setDeletingCatId(null)
    }
  }

  const stockBadge = (p: Product) => {
    if (p.stock <= 0) return <Badge variant="red">{p.stock}</Badge>
    if (p.stock <= (p.minStock ?? 5)) return <Badge variant="yellow">{p.stock}</Badge>
    return <Badge variant="green">{p.stock}</Badge>
  }

  return (
    <div>
      <PageHeader
        title="Inventario"
        description="Gestión de productos y stock"
        actions={
          <div className="flex gap-2">
            <input ref={importRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleImport} />
            <button className="btn-outline btn-sm" onClick={openCatModal}>
              <Tag className="w-4 h-4" /> Categorías
            </button>
            <button className="btn-outline btn-sm" onClick={() => importRef.current?.click()}>
              <Upload className="w-4 h-4" /> Importar
            </button>
            <button className="btn-outline btn-sm" onClick={handleExport}>
              <Download className="w-4 h-4" /> Exportar
            </button>
            <button className="btn-primary btn-sm" onClick={openCreate}>
              <Plus className="w-4 h-4" /> Agregar Producto
            </button>
          </div>
        }
      />

      {/* Filters */}
      <Card className="mb-4 p-4">
        <div className="flex flex-wrap gap-3 items-center">
          <SearchInput value={search} onChange={handleSearch} placeholder="Buscar por nombre o SKU..." className="w-72" />
          <select
            className="input-field w-48"
            value={categoryFilter}
            onChange={(e) => handleFilterChange(e.target.value, lowStockFilter)}
          >
            <option value="">Todas las categorías</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={lowStockFilter}
              onChange={(e) => handleFilterChange(categoryFilter, e.target.checked)}
              className="w-4 h-4 rounded border-gray-300 text-orange-500 focus:ring-orange-400"
            />
            <SlidersHorizontal className="w-4 h-4" />
            Solo bajo stock
          </label>
          {(search || categoryFilter || lowStockFilter) && (
            <button className="btn-ghost btn-sm text-gray-500" onClick={() => { setSearch(''); setCategoryFilter(''); setLowStockFilter(false); load('', '', false, 1); setPage(1) }}>
              Limpiar filtros
            </button>
          )}
        </div>
      </Card>

      {/* Table */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          {loading ? (
            <TableSkeleton rows={8} cols={7} />
          ) : products.length === 0 ? (
            <EmptyState
              icon={<Package className="w-8 h-8" />}
              title="Sin productos"
              description="No se encontraron productos con los filtros aplicados."
              action={<button className="btn-primary btn-sm" onClick={openCreate}><Plus className="w-4 h-4" /> Agregar primero</button>}
            />
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="table-th">SKU</th>
                  <th className="table-th">Nombre</th>
                  <th className="table-th">Categoría</th>
                  <th className="table-th">Precio Venta</th>
                  <th className="table-th">Costo</th>
                  <th className="table-th">Stock</th>
                  <th className="table-th">Ubicación</th>
                  <th className="table-th">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {products.map((p) => (
                  <tr key={p.id} className="table-row">
                    <td className="table-td font-mono text-xs text-gray-500">{p.sku || '—'}</td>
                    <td className="table-td">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{p.name}</p>
                        {p.barcode && <p className="text-xs text-gray-400">{p.barcode}</p>}
                      </div>
                    </td>
                    <td className="table-td text-gray-500">{p.category?.name ?? '—'}</td>
                    <td className="table-td font-semibold text-gray-900">{formatCOP(p.salePrice)}</td>
                    <td className="table-td text-gray-500">{formatCOP(p.costPrice)}</td>
                    <td className="table-td">{stockBadge(p)}</td>
                    <td className="table-td text-gray-500 text-xs">{p.binLocation || '—'}</td>
                    <td className="table-td">
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => openStockAdjust(p)}
                          className="p-1.5 rounded hover:bg-blue-50 text-blue-600 transition-colors"
                          title="Ajustar stock"
                        >
                          <SlidersHorizontal className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => openEdit(p)}
                          className="p-1.5 rounded hover:bg-gray-100 text-gray-500 transition-colors"
                          title="Editar"
                        >
                          <Edit className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedProduct(p); setDeleteDialog(true) }}
                          className="p-1.5 rounded hover:bg-red-50 text-red-500 transition-colors"
                          title="Eliminar"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        {!loading && products.length > 0 && (
          <Pagination page={page} totalPages={totalPages} total={total} limit={LIMIT} onPageChange={(p) => { setPage(p); load(search, categoryFilter, lowStockFilter, p) }} />
        )}
      </Card>

      {/* Product Modal */}
      <Modal
        open={productModal}
        onClose={() => setProductModal(false)}
        title={selectedProduct ? 'Editar Producto' : 'Nuevo Producto'}
        size="lg"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setProductModal(false)}>Cancelar</button>
            <button className="btn-primary" form="product-form" type="submit" disabled={saving}>
              {saving && <Spinner size="sm" />} {selectedProduct ? 'Actualizar' : 'Crear Producto'}
            </button>
          </div>
        }
      >
        <form id="product-form" onSubmit={handleSubmit(onSaveProduct)} className="grid grid-cols-2 gap-4">
          <div className="col-span-2">
            <label className="label">Nombre del Producto *</label>
            <input className={`input-field ${errors.name ? 'input-error' : ''}`} {...register('name')} placeholder="Ej: Aceite motor 4T 20W50 1L" />
            {errors.name && <p className="text-red-500 text-xs mt-1">{errors.name.message}</p>}
          </div>
          <div>
            <label className="label">SKU Interno</label>
            <input className="input-field" {...register('sku')} placeholder="Ej: ACE-4T-001" />
          </div>
          <div>
            <label className="label">Código de Barras</label>
            <input className="input-field" {...register('barcode')} placeholder="EAN-13 o UPC-A" />
          </div>
          <div>
            <label className="label">Categoría *</label>
            <input className={`input-field ${errors.category ? 'input-error' : ''}`} {...register('category')} placeholder="Ej: Aceites, Filtros, Frenos..." />
            {errors.category && <p className="text-red-500 text-xs mt-1">{errors.category.message}</p>}
          </div>
          <div>
            <label className="label">Ubicación (Bin)</label>
            <input className="input-field" {...register('binLocation')} placeholder="Ej: A-12-3" />
          </div>
          <div>
            <label className="label">Precio Costo *</label>
            <input type="number" step="1" min="0" className={`input-field ${errors.costPrice ? 'input-error' : ''}`} {...register('costPrice', { valueAsNumber: true })} placeholder="0" />
            {errors.costPrice && <p className="text-red-500 text-xs mt-1">{errors.costPrice.message}</p>}
          </div>
          <div>
            <label className="label">Precio Venta *</label>
            <input type="number" step="1" min="0" className={`input-field ${errors.salePrice ? 'input-error' : ''}`} {...register('salePrice', { valueAsNumber: true })} placeholder="0" />
            {errors.salePrice && <p className="text-red-500 text-xs mt-1">{errors.salePrice.message}</p>}
          </div>
          <div>
            <label className="label">IVA (%)</label>
            <input type="number" step="1" min="0" max="100" className="input-field" {...register('taxRate', { valueAsNumber: true })} defaultValue={19} />
          </div>
          <div>
            <label className="label">Stock Inicial</label>
            <input type="number" step="1" min="0" className="input-field" {...register('stock', { valueAsNumber: true })} />
          </div>
          <div>
            <label className="label">Stock Mínimo</label>
            <input type="number" step="1" min="0" className="input-field" {...register('minStock', { valueAsNumber: true })} />
          </div>
          <div className="col-span-2">
            <label className="label">Descripción</label>
            <textarea className="input-field resize-none" rows={2} {...register('description')} placeholder="Descripción opcional..." />
          </div>
        </form>
      </Modal>

      {/* Stock Adjust Modal */}
      <Modal
        open={stockModal}
        onClose={() => setStockModal(false)}
        title={`Ajustar Stock — ${selectedProduct?.name ?? ''}`}
        size="sm"
        footer={
          <div className="flex justify-end gap-2">
            <button className="btn-outline" onClick={() => setStockModal(false)}>Cancelar</button>
            <button className="btn-secondary" form="stock-form" type="submit" disabled={saving}>
              {saving && <Spinner size="sm" />} Aplicar Ajuste
            </button>
          </div>
        }
      >
        <form id="stock-form" onSubmit={handleStockSubmit(onAdjustStock)} className="space-y-4">
          <div className="bg-gray-50 rounded-lg p-3 text-sm">
            <span className="text-gray-500">Stock actual: </span>
            <span className="font-bold text-gray-900">{formatNumber(selectedProduct?.stock ?? 0)} unidades</span>
          </div>
          <div>
            <label className="label">Tipo de Movimiento *</label>
            <select className="input-field" {...regStock('type')}>
              {STOCK_TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>
          <div>
            <label className="label">Cantidad *</label>
            <input type="number" step="1" min="1" className={`input-field ${stockErrors.quantity ? 'input-error' : ''}`} {...regStock('quantity', { valueAsNumber: true })} placeholder="0" />
            {stockErrors.quantity && <p className="text-red-500 text-xs mt-1">{stockErrors.quantity.message}</p>}
          </div>
          <div>
            <label className="label">Motivo *</label>
            <input className={`input-field ${stockErrors.reason ? 'input-error' : ''}`} {...regStock('reason')} placeholder="Ej: Compra a proveedor XYZ" />
            {stockErrors.reason && <p className="text-red-500 text-xs mt-1">{stockErrors.reason.message}</p>}
          </div>
        </form>
      </Modal>

      {/* Delete Confirm */}
      <ConfirmDialog
        open={deleteDialog}
        title="Eliminar Producto"
        message={`¿Seguro que deseas eliminar "${selectedProduct?.name}"? Esta acción no se puede deshacer.`}
        confirmLabel="Sí, Eliminar"
        loading={deleting}
        onConfirm={onDelete}
        onCancel={() => setDeleteDialog(false)}
      />

      {/* Gestionar Categorías Modal */}
      <Modal
        open={catModal}
        onClose={() => setCatModal(false)}
        title="Gestionar Categorías"
        size="lg"
        footer={
          <div className="flex justify-end">
            <button className="btn-outline" onClick={() => setCatModal(false)}>Cerrar</button>
          </div>
        }
      >
        {loadingCats ? (
          <div className="flex items-center justify-center h-40">
            <Spinner size="lg" />
          </div>
        ) : catStats.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-400 gap-2">
            <Tag className="w-10 h-10 opacity-30" />
            <p className="text-sm">No hay categorías registradas</p>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-gray-500 mb-3">
              {catStats.length} categoría{catStats.length !== 1 ? 's' : ''} en el sistema.
              Solo se pueden eliminar categorías sin productos activos.
            </p>
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-xs text-gray-500 uppercase tracking-wide">
                  <th className="px-3 py-2 text-left">Nombre</th>
                  <th className="px-3 py-2 text-left">Slug / Prefijo</th>
                  <th className="px-3 py-2 text-center">Productos activos</th>
                  <th className="px-3 py-2 text-right">Acción</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {catStats.map(cat => (
                  <tr key={cat.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2.5 font-medium text-gray-800">{cat.name}</td>
                    <td className="px-3 py-2.5 text-gray-400 font-mono text-xs">
                      {cat.slug}<br />
                      <span className="text-gray-300">{cat.codePrefix}</span>
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      {cat.activeProducts > 0 ? (
                        <Badge variant="green">{cat.activeProducts}</Badge>
                      ) : (
                        <Badge variant="gray">0</Badge>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-right">
                      <button
                        onClick={() => handleDeleteCategory(cat.id, cat.name)}
                        disabled={cat.activeProducts > 0 || deletingCatId === cat.id}
                        className="inline-flex items-center gap-1 text-xs px-2.5 py-1.5 rounded-lg
                          text-red-600 hover:bg-red-50 disabled:opacity-30 disabled:cursor-not-allowed
                          transition-colors"
                        title={cat.activeProducts > 0 ? 'No se puede eliminar: tiene productos activos' : 'Eliminar categoría'}
                      >
                        {deletingCatId === cat.id ? <Spinner size="sm" /> : <Trash2 className="w-3.5 h-3.5" />}
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Modal>
    </div>
  )
}
INVENTORY_EOF

echo "✅ Inventory.tsx actualizado"

# ==========================================
# 3. ACTUALIZAR inventoryService.ts
# ==========================================
echo ""
echo "🔧 3. Actualizando inventoryService.ts..."

cat > frontend/src/services/inventoryService.ts << 'SERVICE_EOF'
import api from './api'
import type { Product, Category, InventoryMovement, PaginatedResponse } from '@/types'

export interface Brand {
  id: string
  name: string
  logoUrl?: string | null
  isActive: boolean
  createdAt: string
}

export interface ProductFilters {
  page?: number
  limit?: number
  search?: string
  categoryId?: string
  lowStock?: boolean
  isActive?: boolean
}

export interface CreateProductPayload {
  name: string
  sku?: string
  barcode?: string
  categoryId: string
  brandId?: string
  costPrice: number
  salePrice: number
  taxRate?: number
  stock?: number
  minStock?: number
  binLocation?: string
  description?: string
}

export interface AdjustStockPayload {
  quantity: number
  type: 'ENTRY' | 'EXIT' | 'ADJUSTMENT' | 'RETURN'
  reason: string
}

export const inventoryService = {
  getProducts: async (filters: ProductFilters = {}): Promise<PaginatedResponse<Product>> => {
    const { data } = await api.get('/inventory/products', { params: filters })
    // data = { success: true, data: X } where X may be array or { data: [...], meta: {...} }
    if (Array.isArray(data)) {
      return { data, total: data.length, page: 1, limit: data.length, totalPages: 1 }
    }
    // Extract inner payload from standard { success, data: X } wrapper
    const payload = (data as any)?.data ?? data
    if (Array.isArray(payload)) {
      return { data: payload, total: payload.length, page: 1, limit: payload.length, totalPages: 1 }
    }
    if (payload?.products) {
      return {
        data: Array.isArray(payload.products) ? payload.products : [],
        total: payload.total ?? payload.products?.length ?? 0,
        page: payload.page ?? 1,
        limit: payload.limit ?? 50,
        totalPages: payload.totalPages ?? 1,
      }
    }
    // Handle { data: [...], meta: { total, page, limit, totalPages } }
    if (payload?.data) {
      const items = Array.isArray(payload.data) ? payload.data : []
      return {
        data:       items,
        total:      payload.meta?.total ?? payload.total ?? items.length,
        page:       payload.meta?.page  ?? payload.page  ?? 1,
        limit:      payload.meta?.limit ?? payload.limit ?? 50,
        totalPages: payload.meta?.totalPages ?? payload.totalPages ?? 1,
      }
    }
    return { data: [], total: 0, page: 1, limit: 50, totalPages: 0 }
  },

  getProduct: async (id: string): Promise<Product> => {
    const { data } = await api.get(`/inventory/products/${id}`)
    return data.product ?? data
  },

  createProduct: async (payload: CreateProductPayload): Promise<Product> => {
    const { data } = await api.post('/inventory/products', payload)
    return data.product ?? data
  },

  updateProduct: async (id: string, payload: Partial<CreateProductPayload>): Promise<Product> => {
    const { data } = await api.put(`/inventory/products/${id}`, payload)
    return data.product ?? data
  },

  deleteProduct: async (id: string): Promise<void> => {
    await api.delete(`/inventory/products/${id}`)
  },

  adjustStock: async (id: string, payload: AdjustStockPayload): Promise<InventoryMovement> => {
    const { data } = await api.post(`/inventory/products/${id}/adjust-stock`, payload)
    return data.movement ?? data
  },

  getCategories: async (): Promise<Category[]> => {
    const { data } = await api.get('/inventory/categories')
    if (Array.isArray(data)) return data
    const inner = data?.data ?? data
    if (Array.isArray(inner)) return inner
    return Array.isArray(inner?.data) ? inner.data : []
  },

  createCategory: async (name: string, description?: string): Promise<Category> => {
    const { data } = await api.post('/inventory/categories', { name, description })
    return data.category ?? data
  },

  getMovements: async (productId?: string): Promise<InventoryMovement[]> => {
    const params = productId ? { productId } : {}
    const { data } = await api.get('/inventory/movements', { params })
    return Array.isArray(data) ? data : data.movements ?? data.data ?? []
  },

  importFromExcel: async (file: File): Promise<{ imported: number; errors: string[] }> => {
    const formData = new FormData()
    formData.append('file', file)
    const { data } = await api.post('/inventory/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return data
  },

  // ──── Brands ────────────────────────────────────────────────────────────

  getBrands: async (params?: { query?: string; isActive?: boolean; limit?: number }): Promise<Brand[]> => {
    const { data } = await api.get('/inventory/brands', { params: { ...params, limit: params?.limit ?? 100 } })
    const result = data.data ?? data
    return Array.isArray(result) ? result : result.data ?? []
  },

  createBrand: async (payload: { name: string; logoUrl?: string }): Promise<Brand> => {
    const { data } = await api.post('/inventory/brands', payload)
    return data.data ?? data
  },

  updateBrand: async (id: string, payload: { name?: string; logoUrl?: string; isActive?: boolean }): Promise<Brand> => {
    const { data } = await api.put(`/inventory/brands/${id}`, payload)
    return data.data ?? data
  },

  deleteBrand: async (id: string): Promise<void> => {
    await api.delete(`/inventory/brands/${id}`)
  },

  // ──── Categories (full CRUD) ───────────────────────────────────────────

  getAllCategories: async (params?: { query?: string; isActive?: boolean; limit?: number }): Promise<Category[]> => {
    const { data } = await api.get('/inventory/categories', { params: { ...params, limit: params?.limit ?? 100 } })
    const result = data.data ?? data
    return Array.isArray(result) ? result : result.data ?? []
  },

  createFullCategory: async (payload: { name: string; codePrefix: string; marginPercentage?: number }): Promise<Category> => {
    const { data } = await api.post('/inventory/categories', payload)
    return data.data ?? data
  },

  updateCategory: async (id: string, payload: { name?: string; codePrefix?: string; marginPercentage?: number; isActive?: boolean }): Promise<Category> => {
    const { data } = await api.put(`/inventory/categories/${id}`, payload)
    return data.data ?? data
  },

  deleteCategory: async (id: string): Promise<void> => {
    await api.delete(`/inventory/categories/${id}`)
  },

  getCategoriesStats: async (): Promise<Array<{ id: string; name: string; slug: string; codePrefix: string; activeProducts: number }>> => {
    const { data } = await api.get('/inventory/categories/stats')
    const result = data.data ?? data
    return Array.isArray(result) ? result : []
  },
}
SERVICE_EOF

echo "✅ inventoryService.ts actualizado"

# ==========================================
# 4. INSTALAR DEPENDENCIAS Y CONSTRUIR
# ==========================================
echo ""
echo "🔨 4. Instalando dependencias del frontend..."
cd frontend
npm install

echo ""
echo "🏗️  5. Construyendo frontend para producción..."
npm run build

if [ $? -ne 0 ]; then
  echo "❌ Error en el build del frontend"
  exit 1
fi

echo "✅ Frontend construido exitosamente"
cd ..

# ==========================================
# 5. DESPLEGAR EN NGINX
# ==========================================
echo ""
echo "📦 6. Desplegando frontend en Nginx..."

# Limpiar directorio actual
docker exec sigc_nginx rm -rf /usr/share/nginx/html/*

# Copiar nuevos archivos
docker cp frontend/dist/. sigc_nginx:/usr/share/nginx/html/

# Verificar permisos
docker exec sigc_nginx chown -R nginx:nginx /usr/share/nginx/html

echo "✅ Archivos desplegados en Nginx"

# ==========================================
# 6. REINICIAR SERVICIOS
# ==========================================
echo ""
echo "🔄 7. Reiniciando servicios..."
docker compose restart nginx

echo ""
echo "⏳ Esperando 10 segundos..."
sleep 10

# ==========================================
# 7. VERIFICAR ESTADO
# ==========================================
echo ""
echo "✅ 8. Verificando estado de servicios..."
docker compose ps

echo ""
echo "=========================================="
echo "✅ DESPLIEGUE COMPLETADO EXITOSAMENTE"
echo "=========================================="
echo ""
echo "🎯 PRUEBAS A REALIZAR:"
echo ""
echo "1. Abre el navegador: https://motos.quantacloud.co"
echo "2. Inicia sesión:"
echo "   Email: admin@clavijosmotos.com"
echo "   Password: Admin123!"
echo ""
echo "3. Ve a: /inventory"
echo "4. Haz clic en el botón 'Categorías' (ícono de Tag)"
echo "5. Deberías ver:"
echo "   ✓ Spinner de carga"
echo "   ✓ Tabla con 2 categorías:"
echo "     - Aceite 5.5 Litros"
echo "     - filtrador"
echo "   ✓ Cada una con su número de productos activos"
echo "   ✓ Botón 'Eliminar' (deshabilitado si tiene productos)"
echo ""
echo "📋 FUNCIONALIDADES DISPONIBLES:"
echo "   ✅ Ver todas las categorías del sistema"
echo "   ✅ Ver cantidad de productos activos por categoría"
echo "   ✅ Eliminar categorías (solo si están vacías)"
echo "   ✅ El backend valida que no haya productos antes de eliminar"
echo ""
echo "💡 Si ves algún error:"
echo "   • Presiona Ctrl + Shift + R (limpiar caché)"
echo "   • Abre DevTools (F12) → Console para ver errores"
echo "   • Ejecuta: docker compose logs -f app nginx"
echo ""
echo "🚀 ¡Listo para tu entrega mañana!"
echo ""


