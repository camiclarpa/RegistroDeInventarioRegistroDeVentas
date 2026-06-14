import re

filepath = 'src/pages/Inventory.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# 1. Localizamos la función openEdit
# Buscamos el inicio y reemplazamos el bloque interno para asegurar la carga
target_start = "const openEdit = (p: Product) => {"
target_end = "setProductModal(true)"

if target_start in content and target_end in content:
    # Extraemos el bloque actual para no borrar otras funciones
    start_idx = content.find(target_start)
    end_idx = content.find(target_end) + len(target_end)
    
    # NUEVA LÓGICA ROBUSTA
    new_logic = """const openEdit = (p: Product) => {
    setSelectedProduct(p);
    setAuditReason('');
    setAuditMotivo('');
    setAuditDescripcion('');
    setMotivoError('');
    setEditOpenedAt(new Date());
    
    // 🛡️ CARGA FORZADA DE DATOS:
    // Intenta leer las columnas exactas de la BD ("skuInternal", "barcodeExternal")
    // y también sus variantes por si el backend las normaliza.
    const dbSku = (p as any).skuInternal || (p as any)['skuInternal'] || p.sku || '';
    const dbBarcode = (p as any).barcodeExternal || (p as any)['barcodeExternal'] || p.barcode || '';
    const dbName = (p as any).nameCommercial || (p as any)['nameCommercial'] || p.name || '';

    // Sincronizamos estados globales para evitar conflictos con el generador automático
    setAutoSku(dbSku);
    setAutoBarcode(dbBarcode);

    // Inyectamos los datos en el formulario
    reset({
      name: dbName,
      sku: dbSku,
      barcode: dbBarcode,
      category: (p as any).category?.name || p.categoryName || '',
      brandId: p.brandId,
      costPrice: p.costPrice,
      salePrice: p.salePrice,
      taxRate: p.taxRate,
      stock: p.stock,
      minStock: p.minStock,
      binLocation: (p as any).locationBin || p.binLocation || '',
      description: (p as any).descriptionTech || p.description || '',
    });
    setProductModal(true)
  }"""
    
    # Reemplazamos solo esa función
    content = content[:start_idx] + new_logic + content[end_idx:]
    
    print("✅ openEdit reescrito con carga forzada de datos.")
else:
    print("❌ No se pudo localizar openEdit para reescribir.")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
