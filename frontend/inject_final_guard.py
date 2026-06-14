filepath = 'src/pages/Inventory.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# Buscamos la línea exacta que dispara la generación
target = "if (catId && name && name.length >= 3) triggerAutoGenerate(catId, brandId, name);"
if target in content:
    content = content.replace(
        target,
        "// 🛡️ BLOQUEO: No generar si editamos producto existente\n      if (selectedProduct?.id) return;\n      if (catId && name && name.length >= 3) triggerAutoGenerate(catId, brandId, name);"
    )
    print("✅ Guardia de edición inyectada correctamente")
else:
    print("ℹ️ Guardia ya existe o patrón no encontrado")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)
