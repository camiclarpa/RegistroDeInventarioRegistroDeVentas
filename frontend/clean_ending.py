filepath = 'src/pages/Inventory.tsx'
with open(filepath, 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Buscamos la última línea que contiene solo '      {'
# y está seguida cerca por '</div>'
new_lines = []
skip_next_empty = False
for i, line in enumerate(lines):
    stripped = line.strip()
    # Si es un corchete abierto solitario y estamos cerca del final del archivo
    if stripped == '{' and i > len(lines) - 20:
        print(f"️  Eliminando línea {i+1}: '{stripped}'")
        continue # No agregamos esta línea a la lista nueva
    new_lines.append(line)

with open(filepath, 'w', encoding='utf-8') as f:
    f.writelines(new_lines)

print("✅ Archivo limpio.")
