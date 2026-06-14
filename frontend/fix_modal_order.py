filepath = 'src/pages/Inventory.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

fixed_lines = []
i = 0
while i < len(lines):
    # Detectar: línea con SOLO ")}" seguida de una línea con "</Modal>"
    if lines[i].strip() == ')}' and i + 1 < len(lines) and '</Modal>' in lines[i+1]:
        # Intercambiar: </Modal> va PRIMERO, luego )}
        fixed_lines.append(lines[i+1])
        fixed_lines.append(lines[i])
        print(f"✅ Corregido orden en línea {i+1} (se movió </Modal> antes de }})")
        i += 2
        continue
    
    fixed_lines.append(lines[i])
    i += 1

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(fixed_lines)

print("💾 Archivo guardado correctamente.")
