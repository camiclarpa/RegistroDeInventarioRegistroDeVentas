import { useState, useEffect, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { toast } from 'sonner'
import { Plus, Edit, Trash2, Tag, Layers, ChevronLeft, ChevronRight } from 'lucide-react'
import { inventoryService, type Brand } from '@/services/inventoryService'
import type { Category } from '@/types'
import { PageHeader } from '@/components/ui/PageHeader'
import { Card } from '@/components/ui/Card'
import { Modal } from '@/components/ui/Modal'
import { Badge } from '@/components/ui/Badge'
import { Spinner } from '@/components/ui/Spinner'
import { EmptyState } from '@/components/ui/EmptyState'
import { ConfirmDialog } from '@/components/ui/ConfirmDialog'

type ActiveTab = 'brands' | 'categories'

interface BrandForm { name: string; logoUrl?: string }
interface CategoryForm { name: string; codePrefix: string; marginPercentage?: number }

const ITEMS_PER_PAGE = 15

export default function Classifications() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('brands')

  // ── Brands state ────────────────────────────────────────────────────────
  const [brands, setBrands] = useState<Brand[]>([])
  const [brandsLoading, setBrandsLoading] = useState(true)
  const [brandModal, setBrandModal] = useState(false)
  const [selectedBrand, setSelectedBrand] = useState<Brand | null>(null)
  const [brandSaving, setBrandSaving] = useState(false)
  const [confirmDeleteBrand, setConfirmDeleteBrand] = useState<Brand | null>(null)
  
  // Brands pagination
  const [brandPage, setBrandPage] = useState(1)
  const [brandTotal, setBrandTotal] = useState(0)
  const [brandTotalPages, setBrandTotalPages] = useState(0)

  // ── Categories state ────────────────────────────────────────────────────
  const [categories, setCategories] = useState<Category[]>([])
  const [catsLoading, setCatsLoading] = useState(true)
  const [catModal, setCatModal] = useState(false)
  const [selectedCat, setSelectedCat] = useState<Category | null>(null)
  const [catSaving, setCatSaving] = useState(false)
  const [confirmDeleteCat, setConfirmDeleteCat] = useState<Category | null>(null)
  
  // Categories pagination
  const [catPage, setCatPage] = useState(1)
  const [catTotal, setCatTotal] = useState(0)
  const [catTotalPages, setCatTotalPages] = useState(0)

  // ── Forms ───────────────────────────────────────────────────────────────
  const brandForm = useForm<BrandForm>()
  const catForm   = useForm<CategoryForm>({ defaultValues: { marginPercentage: 30 } })

  // ── Loaders ─────────────────────────────────────────────────────────────
  const loadBrands = useCallback(async (page: number = 1) => {
    setBrandsLoading(true)
    try { 
      const response = await inventoryService.getBrandsPaginated({ limit: ITEMS_PER_PAGE, page })
      console.log('🔍 loadBrands response:', response)
      console.log('🔍 Meta:', response.meta)
      setBrands(response.data)
      setBrandTotal(response.meta.total)
      setBrandTotalPages(response.meta.totalPages)
      console.log('✅ brandTotalPages:', response.meta.totalPages)
    }
    catch (err) { 
      console.error('❌ Error cargando marcas:', err)
      toast.error('Error al cargar marcas') 
    }
    finally { setBrandsLoading(false) }
  }, [])

  const loadCategories = useCallback(async (page: number = 1) => {
    setCatsLoading(true)
    try { 
      const response = await inventoryService.getCategoriesPaginated({ limit: ITEMS_PER_PAGE, page })
      console.log('🔍 loadCategories response:', response)
      console.log('🔍 Meta:', response.meta)
      setCategories(response.data)
      setCatTotal(response.meta.total)
      setCatTotalPages(response.meta.totalPages)
      console.log('✅ catTotalPages:', response.meta.totalPages)
    }
    catch (err) { 
      console.error('❌ Error cargando categorías:', err)
      toast.error('Error al cargar categorías') 
    }
    finally { setCatsLoading(false) }
  }, [])

  useEffect(() => { 
    loadBrands(brandPage)
    loadCategories(catPage)
  }, [loadBrands, loadCategories, brandPage, catPage])

  // ── Brand handlers ───────────────────────────────────────────────────────
  const openBrandCreate = () => {
    setSelectedBrand(null)
    brandForm.reset({ name: '', logoUrl: '' })
    setBrandModal(true)
  }
  const openBrandEdit = (b: Brand) => {
    setSelectedBrand(b)
    brandForm.reset({ name: b.name, logoUrl: b.logoUrl ?? '' })
    setBrandModal(true)
  }
  const onSaveBrand = async (data: BrandForm) => {
    setBrandSaving(true)
    try {
      const payload = { name: data.name, ...(data.logoUrl ? { logoUrl: data.logoUrl } : {}) }
      if (selectedBrand) {
        await inventoryService.updateBrand(selectedBrand.id, payload)
        toast.success('Marca actualizada')
      } else {
        await inventoryService.createBrand(payload)
        toast.success('Marca creada')
      }
      setBrandModal(false)
      loadBrands(brandPage)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar la marca'
      toast.error(msg)
    } finally { setBrandSaving(false) }
  }
  const deleteBrand = async (b: Brand) => {
    try {
      await inventoryService.deleteBrand(b.id)
      toast.success('Marca desactivada')
      loadBrands(brandPage)
    } catch { toast.error('No se puede eliminar: la marca tiene productos activos') }
    finally { setConfirmDeleteBrand(null) }
  }

  // ── Category handlers ────────────────────────────────────────────────────
  const openCatCreate = () => {
    setSelectedCat(null)
    catForm.reset({ name: '', codePrefix: '', marginPercentage: 30 })
    setCatModal(true)
  }
  const openCatEdit = (c: Category) => {
    setSelectedCat(c)
    catForm.reset({ 
      name: c.name, 
      codePrefix: (c as any).codePrefix ?? '', 
      marginPercentage: (c as any).marginPercentage ?? 30 
    })
    setCatModal(true)
  }
  const onSaveCat = async (data: CategoryForm) => {
    setCatSaving(true)
    try {
      const payload = { 
        name: data.name, 
        codePrefix: data.codePrefix,
        marginPercentage: data.marginPercentage ?? 30
      }
      if (selectedCat) {
        await inventoryService.updateCategory(selectedCat.id, payload)
        toast.success('Categoría actualizada')
      } else {
        await inventoryService.createCategory(payload)
        toast.success('Categoría creada')
      }
      setCatModal(false)
      loadCategories(catPage)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Error al guardar la categoría'
      toast.error(msg)
    } finally { setCatSaving(false) }
  }
  const deleteCat = async (c: Category) => {
    try {
      await inventoryService.deleteCategory(c.id)
      toast.success('Categoría desactivada')
      loadCategories(catPage)
    } catch { toast.error('No se puede eliminar: la categoría tiene productos activos') }
    finally { setConfirmDeleteCat(null) }
  }

  // ── Pagination helpers ───────────────────────────────────────────────────
  const goToBrandPage = (page: number) => {
    if (page >= 1 && page <= brandTotalPages) {
      setBrandPage(page)
    }
  }

  const goToCatPage = (page: number) => {
    if (page >= 1 && page <= catTotalPages) {
      setCatPage(page)
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Clasificaciones"
        description="Gestiona las marcas y categorías de tus productos"
      />

      <Card>
        <div className="border-b">
          <div className="flex gap-4">
            <button 
              onClick={() => setActiveTab('brands')} 
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'brands' 
                  ? 'border-orange-500 text-orange-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Tag className="w-4 h-4" />
              Marcas ({brandTotal})
            </button>
            <button 
              onClick={() => setActiveTab('categories')} 
              className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                activeTab === 'categories' 
                  ? 'border-orange-500 text-orange-600' 
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <Layers className="w-4 h-4" />
              Categorías ({catTotal})
            </button>
          </div>
        </div>

        {/* Brands Tab */}
        {activeTab === 'brands' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Marcas</h3>
              <button onClick={openBrandCreate} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nueva Marca
              </button>
            </div>

            {brandsLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : brands.length === 0 ? (
              <EmptyState title="No hay marcas" description="Crea tu primera marca para comenzar" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-th">Nombre</th>
                        <th className="table-th">Estado</th>
                        <th className="table-th">Logo URL</th>
                        <th className="table-th">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {brands.map((b) => (
                        <tr key={b.id} className="table-row">
                          <td className="table-td font-medium">{b.name}</td>
                          <td className="table-td">
                            <Badge variant={b.isActive ? 'green' : 'red'}>
                              {b.isActive ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </td>
                          <td className="table-td text-gray-400 text-xs truncate max-w-xs">
                            {b.logoUrl ?? '—'}
                          </td>
                          <td className="table-td">
                            <div className="flex gap-1">
                              <button 
                                onClick={() => openBrandEdit(b)} 
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500" 
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setConfirmDeleteBrand(b)} 
                                className="p-1.5 rounded hover:bg-red-50 text-red-500" 
                                title="Desactivar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {brandTotalPages >= 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      Página {brandPage} de {brandTotalPages} • {brandTotal} marcas en total
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => goToBrandPage(brandPage - 1)}
                        disabled={brandPage === 1}
                        className="btn-outline flex items-center gap-1 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </button>
                      <button
                        onClick={() => goToBrandPage(brandPage + 1)}
                        disabled={brandPage === brandTotalPages}
                        className="btn-outline flex items-center gap-1 disabled:opacity-50"
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Categories Tab */}
        {activeTab === 'categories' && (
          <div className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Categorías</h3>
              <button onClick={openCatCreate} className="btn-primary flex items-center gap-2">
                <Plus className="w-4 h-4" />
                Nueva Categoría
              </button>
            </div>

            {catsLoading ? (
              <div className="flex justify-center py-12"><Spinner /></div>
            ) : categories.length === 0 ? (
              <EmptyState title="No hay categorías" description="Crea tu primera categoría para comenzar" />
            ) : (
              <>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-th">Nombre</th>
                        <th className="table-th">Prefijo</th>
                        <th className="table-th">Margen %</th>
                        <th className="table-th">Estado</th>
                        <th className="table-th">Acciones</th>
                      </tr>
                    </thead>
                    <tbody>
                      {categories.map((c) => (
                        <tr key={c.id} className="table-row">
                          <td className="table-td font-medium">{c.name}</td>
                          <td className="table-td">
                            <span className="font-mono text-xs bg-gray-100 px-2 py-0.5 rounded">
                              {(c as any).codePrefix ?? '—'}
                            </span>
                          </td>
                          <td className="table-td text-gray-500">
                            {(c as any).marginPercentage ?? '—'}%
                          </td>
                          <td className="table-td">
                            <Badge variant={(c as any).isActive !== false ? 'green' : 'red'}>
                              {(c as any).isActive !== false ? 'Activa' : 'Inactiva'}
                            </Badge>
                          </td>
                          <td className="table-td">
                            <div className="flex gap-1">
                              <button 
                                onClick={() => openCatEdit(c)} 
                                className="p-1.5 rounded hover:bg-gray-100 text-gray-500" 
                                title="Editar"
                              >
                                <Edit className="w-4 h-4" />
                              </button>
                              <button 
                                onClick={() => setConfirmDeleteCat(c)} 
                                className="p-1.5 rounded hover:bg-red-50 text-red-500" 
                                title="Desactivar"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                {catTotalPages >= 1 && (
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="text-sm text-gray-600">
                      Página {catPage} de {catTotalPages} • {catTotal} categorías en total
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => goToCatPage(catPage - 1)}
                        disabled={catPage === 1}
                        className="btn-outline flex items-center gap-1 disabled:opacity-50"
                      >
                        <ChevronLeft className="w-4 h-4" />
                        Anterior
                      </button>
                      <button
                        onClick={() => goToCatPage(catPage + 1)}
                        disabled={catPage === catTotalPages}
                        className="btn-outline flex items-center gap-1 disabled:opacity-50"
                      >
                        Siguiente
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </Card>

      {/* Brand Modal */}
      <Modal open={brandModal} onClose={() => setBrandModal(false)} title={selectedBrand ? 'Editar Marca' : 'Nueva Marca'}>
        <form onSubmit={brandForm.handleSubmit(onSaveBrand)} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...brandForm.register('name', { required: 'El nombre es obligatorio' })} className="input-field" placeholder="Ej: Yamaha" />
            {brandForm.formState.errors.name && <p className="text-red-500 text-sm mt-1">{brandForm.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Logo URL (opcional)</label>
            <input {...brandForm.register('logoUrl')} className="input-field" placeholder="https://..." />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <button type="button" onClick={() => setBrandModal(false)} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={brandSaving}>
              {brandSaving ? <Spinner size="sm" /> : selectedBrand ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Category Modal */}
      <Modal open={catModal} onClose={() => setCatModal(false)} title={selectedCat ? 'Editar Categoría' : 'Nueva Categoría'}>
        <form onSubmit={catForm.handleSubmit(onSaveCat)} className="space-y-4">
          <div>
            <label className="label">Nombre *</label>
            <input {...catForm.register('name', { required: 'El nombre es obligatorio' })} className="input-field" placeholder="Ej: Aceites" />
            {catForm.formState.errors.name && <p className="text-red-500 text-sm mt-1">{catForm.formState.errors.name.message}</p>}
          </div>
          <div>
            <label className="label">Prefijo SKU *</label>
            <input {...catForm.register('codePrefix', { required: 'El prefijo es obligatorio' })} className="input-field" placeholder="Ej: ACE" maxLength={6} />
            {catForm.formState.errors.codePrefix && <p className="text-red-500 text-sm mt-1">{catForm.formState.errors.codePrefix.message}</p>}
          </div>
          <div>
            <label className="label">Margen de Ganancia %</label>
            <input type="number" {...catForm.register('marginPercentage', { valueAsNumber: true })} className="input-field" placeholder="30" min="0" max="100" />
          </div>
          <div className="flex gap-2 justify-end pt-4">
            <button type="button" onClick={() => setCatModal(false)} className="btn-outline">Cancelar</button>
            <button type="submit" className="btn-primary" disabled={catSaving}>
              {catSaving ? <Spinner size="sm" /> : selectedCat ? 'Actualizar' : 'Crear'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Confirm Delete Brand */}
      <ConfirmDialog
        open={!!confirmDeleteBrand}
        title="Desactivar Marca"
        message={`¿Seguro que deseas desactivar "${confirmDeleteBrand?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={() => confirmDeleteBrand && deleteBrand(confirmDeleteBrand)}
        onCancel={() => setConfirmDeleteBrand(null)}
      />

      {/* Confirm Delete Category */}
      <ConfirmDialog
        open={!!confirmDeleteCat}
        title="Desactivar Categoría"
        message={`¿Seguro que deseas desactivar "${confirmDeleteCat?.name}"? Esta acción no se puede deshacer.`}
        onConfirm={() => confirmDeleteCat && deleteCat(confirmDeleteCat)}
        onCancel={() => setConfirmDeleteCat(null)}
      />
    </div>
  )
}
