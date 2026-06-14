import re
import sys

filepath = 'src/pages/Inventory.tsx'

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. Eliminar residuo zona 1 (</> </Modal> + } ) } huérfanos)
    pattern1 = r'\s*</>\s*</Modal>\s*\)\}\s*\n\s*\)\}\s*\n'
    content = re.sub(pattern1, '', content)
    print("✅ Residuo 1 eliminado (Zona ~1317)")

    # 2. Eliminar residuo zona 2 (</div> </Modal> + } ) huérfano)
    pattern2 = r'\s*</div>\s*</Modal>\s*\n\s*\)\}\s*\n'
    content = re.sub(pattern2, '', content)
    print("✅ Residuo 2 eliminado (Zona ~1404)")

    # 3. Limpiar comentarios vacíos duplicados que puedan quedar
    content = re.sub(r'\n\s*/\* MODAL DE IMPRESIÓN DE ETIQUETAS \*/\s*\n\s*\n', '\n', content)
    print("✅ Comentarios residuales limpiados")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("💾 Archivo guardado correctamente.")

except Exception as e:
    print(f"❌ Error: {e}")
    sys.exit(1)
