import { forwardRef, useImperativeHandle, useRef, useState, useEffect } from 'react'
import { Barcode, CheckCircle, Plus } from 'lucide-react'
import { toast } from 'sonner'
import { posService } from '@/services/posService'
import { SearchSuggestionsDropdown } from '@/components/SearchSuggestionsDropdown'
import { Card } from '@/components/ui/Card'
import { Spinner } from '@/components/ui/Spinner'
import { formatCOP } from '@/utils/formatters'
import { beepSound } from '@/utils/helpers'
import type { Product } from '@/types'

export interface SmartScannerHandle {
  focus: () => void
}

interface Props {
  onProductScanned: (product: Product) => void
  onNewProduct?: (barcode: string) => void
  products?: Product[]
  disabled?: boolean
}

export const SmartScannerInput = forwardRef<SmartScannerHandle, Props>(
  function SmartScannerInput({ onProductScanned, onNewProduct, disabled, products }, ref) {
    const inputRef = useRef<HTMLInputElement>(null)
    const [value, setValue] = useState('')
    const [scanning, setScanning] = useState(false)
    const [showSuggestions, setShowSuggestions] = useState(false)
    const [lastScanned, setLastScanned] = useState<Product | null>(null)

    useImperativeHandle(ref, () => ({
      focus: () => {
        inputRef.current?.focus()
        inputRef.current?.select()
      },
    }))



    const refocus = () => setTimeout(() => inputRef.current?.focus(), 50)

    const addProduct = (product: Product) => {
      if (product.stock <= 0) {
        toast.error(`Sin stock: "${product.name}"`)
        return
      }
      beepSound()
      setLastScanned(product)
      toast.success(`Agregado: ${product.name}`)
      onProductScanned(product)
      setValue('')
      setShowSuggestions(false)
      refocus()
    }

    const handleClick = () => {
      console.log('🔘 Botón Agregar clickeado - Valor:', value);
      handleScan();
    }

    const handleScan = async () => {
      const code = value.trim()
      if (!code) return
      setShowSuggestions(false)
      setScanning(true)
      try {
        console.log('📡 Intentando escanear:', code)
        
        // 1. Intento directo (Backend endpoint específico)
        let product = await posService.scanProduct(code)
        
        // 2. Si falla, intentamos búsqueda general (fallback)
        if (!product) {
          console.log('⚠️ scanProduct falló, intentando búsqueda general...')
          product = await posService.searchProduct(code)
        }

        if (!product) {
          console.log('⚠️ Producto no encontrado, es un producto nuevo')
          if (onNewProduct) {
            onNewProduct(code)
            setValue('')
            refocus()
            return
          }
          console.error('❌ Producto no encontrado tras ambos intentos')
          toast.error(`Código no encontrado: "${code}"`)
          refocus()
          return
        }

        console.log('✅ Producto agregado al carrito:', product.name)
        addProduct(product)
      } catch (err) {
        console.error('💥 Error crítico al escanear:', err)
        toast.error('Error al escanear producto')
        refocus()
      } finally {
        setScanning(false)
      }
    }

    return (
      <Card className="p-4 space-y-3">
        <label className="label">Código de barras / Nombre de producto</label>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Barcode className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              ref={inputRef}
              value={value}
              onChange={(e) => {
                setValue(e.target.value)
                setShowSuggestions(e.target.value.length >= 2)
              }}
              onKeyDown={(e) => {
                console.log('⌨️ TECLA PRESIONADA:', e.key, '| Código:', value);
                if (e.key === 'Enter') { 
                    e.preventDefault(); 
                    console.log('✅ ENTER detectado - Ejecutando handleScan');
                    handleScan() 
                }
                if (e.key === 'Escape') { setValue(''); setShowSuggestions(false) }
              }}
              onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
              onFocus={() => value.length >= 2 && setShowSuggestions(true)}
              placeholder="Escanear código o escribir nombre..."
              className="input-field pl-9"
              autoComplete="off"
              disabled={disabled || scanning}
            />
            <SearchSuggestionsDropdown
              query={value}
              visible={showSuggestions}
              onSelect={addProduct}
            />
          </div>
          <button
            className="btn-secondary"
            onClick={handleClick}
            disabled={disabled || scanning || !value.trim()}
          >
            {scanning ? <Spinner size="sm" /> : <Plus className="w-4 h-4" />}
            Agregar
          </button>
        </div>

        {lastScanned && (
          <div className="flex items-center gap-3 bg-green-50 border border-green-200 rounded-lg px-3 py-2 text-sm animate-fade-in">
            <CheckCircle className="w-4 h-4 text-green-600 flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-medium text-green-900 truncate">{lastScanned.name}</p>
              <p className="text-xs text-green-600">{lastScanned.sku} · Stock: {lastScanned.stock}</p>
            </div>
            <p className="font-semibold text-green-700 flex-shrink-0">{formatCOP(lastScanned.salePrice)}</p>
          </div>
        )}
      </Card>
    )
  }
)
