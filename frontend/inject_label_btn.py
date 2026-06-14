filepath = 'src/pages/Inventory.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Marcador exacto detectado en tu diagnóstico (cierre Editar + apertura Eliminar)
target = '''                        </button>
                        <button
                          onClick={() => { setSelectedProduct(p); setDeleteDialog(true) }}'''

new_btn = '''                        </button>
                        <button
                          onClick={() => { setLabelProduct(p); setShowLabelModal(true); }}
                          className="p-1.5 rounded hover:bg-green-100 text-green-600 transition-colors"
                          title="Generar etiqueta"
                        >
                          <Tag className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => { setSelectedProduct(p); setDeleteDialog(true) }}'''

if target in content:
    content = content.replace(target, new_btn, 1)
    print("✅ Botón verde inyectado exitosamente en la columna ACCIONES")
else:
    # Fallback por variación mínima de espacios
    content = content.replace('                        </button>\n                        <button\n                          onClick={() => { setSelectedProduct(p); setDeleteDialog(true) }}', new_btn, 1)
    print("✅ Botón inyectado (fallback)")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
