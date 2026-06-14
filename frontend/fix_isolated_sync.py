import re

filepath = 'src/pages/Inventory.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# ==========================================
# FIX 1: openEdit -> Sincronización Manual de Estados
# ==========================================
# Buscamos el bloque openEdit y lo reemplazamos por una versión que inyecta
# setAutoSku/P explicitamente con los datos del producto p.
old_openedit = r'const openEdit = \(p: Product\) => \{[\s\S]*?setProductModal\(true\)\s*\}'

new_openedit = '''const openEdit = (p: Product) => {
    setSelectedProduct(p);
    setAuditReason('');
    setAuditMotivo('');
    setAuditDescripcion('');
    setMotivoError('');
    setEditOpenedAt(new Date());
    
    // 🔄 SINCRONIZACIÓN MANUAL: Obligar a los estados globales a usar los datos de ESTE producto
    const realSku = (p as any).skuInternal || p.sku || '';
    const realBarcode = (p as any).barcodeExternal || p.barcode || '';
    
    setAutoSku(realSku);
    setAutoBarcode(realBarcode);
    
    reset({
      name:        p.name,
      sku:         realSku,
      barcode:     realBarcode,
      category:    p.category?.name ?? '',
      brandId:     p.brandId,
      costPrice:   p.costPrice,
      salePrice:   p.salePrice,
      taxRate:     p.taxRate,
      stock:       p.stock,
      minStock:    p.minStock,
      binLocation: p.binLocation,
      description: p.description,
    });
    setProductModal(true);
  }'''

if re.search(old_openedit, content, re.DOTALL):
    content = re.sub(old_openedit, new_openedit, content, flags=re.DOTALL)
    print("✅ openEdit: Sincronización manual de SKU/Barcode implementada")
else:
    print("⚠️ openEdit no encontrado en formato esperado.")

# ==========================================
# FIX 2: useEffect -> Guardia de "Si ya existe, no toques"
# ==========================================
# Añadimos una guardia extra para impedir que el temporizador sobrescriba
# un SKU que ya existe en el formulario.
target_guard = "if (selectedProduct?.id) return;"
improved_guard = """if (selectedProduct?.id) return;
      if (watch('sku')) return; // ⛔ NO SOBREESCRIBIR SI YA HAY UN SKU CARGADO"""

if target_guard in content:
    content = content.replace(target_guard, improved_guard, 1)
    print("✅ useEffect: Guardia anti-sobrescritura agregada")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
print("💾 Archivo guardado.")
