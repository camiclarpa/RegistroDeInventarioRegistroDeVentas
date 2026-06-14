import sys

filepath = 'src/pages/Inventory.tsx'

print("🔍 Iniciando diagnóstico y reparación...")

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # 1. CORREGIR SINTAXIS ROTA (Eliminar las barras invertidas ilegales)
    # Buscamos \' y lo reemplazamos por '
    if "\\'" in content:
        content = content.replace("\\'", "'")
        print("✅ CORREGIDO: Se eliminaron las barras invertidas ilegales (\\').")
    else:
        print("ℹ️ INFO: No se encontraron barras invertidas ilegales.")

    # 2. ELIMINAR MODAL DUPLICADO
    # Buscamos el segundo bloque de modal que dice "Para productos existentes"
    marker = "/* MODAL DE IMPRESIÓN DE ETIQUETAS - Para productos existentes */"
    if marker in content:
        start_idx = content.find(marker)
        # Buscamos el cierre del bloque (el primer }) después del comentario
        end_idx = content.find(")}", start_idx + len(marker))
        if end_idx != -1:
            content = content[:start_idx] + content[end_idx + 2:]
            print("✅ CORREGIDO: Se eliminó el modal duplicado.")
        else:
            print("⚠️  ADVERTENCIA: No se pudo encontrar el cierre del modal duplicado.")
    else:
        print("ℹ️ INFO: No se encontró el modal duplicado.")

    # Guardar archivo
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("💾 Archivo guardado exitosamente.")

except Exception as e:
    print(f"❌ ERROR FATAL: {e}")
    sys.exit(1)
