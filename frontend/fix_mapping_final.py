import sys

filepath = 'src/pages/Inventory.tsx'

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # ==========================================
    # FIX 1: openEdit -> Leer skuInternal/barcodeExternal de la BD
    # ==========================================
    if 'sku:         p.sku,' in content:
        content = content.replace('sku:         p.sku,', "sku:         (p as any).skuInternal || p.sku || '',")
        content = content.replace('barcode:     p.barcode,', "barcode:     (p as any).barcodeExternal || p.barcode || '',")
        print("✅ FIX 1: openEdit ahora carga códigos REALES desde la BD")

    # ==========================================
    # FIX 2: onSaveProduct -> Mapear sku/barcode a skuInternal/barcodeExternal para guardar
    # ==========================================
    if 'const payload = {\n        ...formData,\n        categoryId,' in content:
        content = content.replace(
            'const payload = {\n        ...formData,\n        categoryId,',
            "const payload = {\n        ...formData,\n        skuInternal: formData.sku,\n        barcodeExternal: formData.barcode,\n        categoryId,"
        )
        print("✅ FIX 2: onSaveProduct ahora guarda los códigos en las columnas correctas de la BD")

    # ==========================================
    # FIX 3: Modal de etiquetas -> Usar labelProduct si viene de la tabla
    # ==========================================
    old_modal_props = "productName={watch('name') || 'Producto sin nombre'}\n          sku={autoSku || 'SKU-PENDIENTE'}\n          barcode={autoBarcode || '0000000000000'}\n          quantity={watch('stock') || 1}"
    new_modal_props = "productName={labelProduct?.name || watch('name') || 'Producto sin nombre'}\n          sku={labelProduct?.skuInternal || labelProduct?.sku || autoSku || 'SKU-PENDIENTE'}\n          barcode={labelProduct?.barcodeExternal || labelProduct?.barcode || autoBarcode || '0000000000000'}\n          quantity={labelProduct?.stock || watch('stock') || 1}"
    
    if old_modal_props in content:
        content = content.replace(old_modal_props, new_modal_props)
        print("✅ FIX 3: Modal de etiquetas ahora respeta datos de productos EXISTENTES")
    else:
        print("ℹ️ FIX 3: Props del modal ya están actualizadas o formato distinto")

    # Guardar
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("\n💾 Archivo actualizado exitosamente.")

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
