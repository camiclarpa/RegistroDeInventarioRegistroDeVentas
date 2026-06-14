import re

filepath = 'src/pages/Inventory.tsx'

print("🔍 Analizando sintaxis de modales...")

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # Patrón: Busca )} seguido de una nueva línea, y luego una línea que termine en </Modal>
    # Captura la indentación y el contenido para reordenarlos correctamente.
    # Esto maneja casos con etiquetas extra como </> o </div> antes de </Modal>.
    pattern = r'(\s+)\)\}\n(\s+)(.*?<\/Modal>)'

    def swap(match):
        indent_block = match.group(1)
        indent_tag = match.group(2)
        tag_line = match.group(3)
        # Retornamos: La línea con las etiquetas primero, luego el cierre del bloque )}
        return f"{indent_tag}{tag_line}\n{indent_block})}"

    # Reemplazar todas las ocurrencias
    new_content, count = re.subn(pattern, swap, content)

    if count > 0:
        print(f"✅ Se corrigieron {count} errores de orden en los cierres de Modales.")
    else:
        print("ℹ️ No se encontraron errores de orden adicionales (ya podría estar limpio).")

    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    
    print("💾 Archivo guardado exitosamente.")

except Exception as e:
    print(f"❌ Error crítico: {e}")
    import traceback
    traceback.print_exc()
