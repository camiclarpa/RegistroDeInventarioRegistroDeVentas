import re

filepath = 'src/pages/Inventory.tsx'

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # ==========================================
    # FIX 1: ARREGLAR EL BOTÓN (Falta <button)
    # ==========================================
    # Buscamos una línea que empiece con espacios y luego 'type="button" onClick={'
    # y le agregamos '<button ' al principio.
    # Esto arregla el botón que perdió su etiqueta de apertura.
    pattern_btn = r'^(\s+)type="button" onClick=\{'
    replacement_btn = r'\1<button type="button" onClick={'
    
    # Contamos cuántos reemplazos hacemos para confirmar
    content, count_btn = re.subn(pattern_btn, replacement_btn, content, flags=re.MULTILINE)
    
    if count_btn > 0:
        print(f"✅ FIX 1: Se agregó la etiqueta '<button' faltante en {count_btn} lugar(es).")
    else:
        print("ℹ️ FIX 1: No se encontró el botón roto (ya podría estar arreglado).")

    # ==========================================
    # FIX 2: ARREGLAR EL MODAL (Orden invertido)
    # ==========================================
    # Buscamos el patrón donde ')}' está seguido inmediatamente por '</Modal>'
    # y los intercambiamos para que '</Modal>' quede primero.
    # Esto arregla la sintaxis JSX inválida al final del archivo.
    pattern_modal = r'(\s+)\)\}\n(\s+)<\/Modal>'
    
    def swap_modal(match):
        indent_close_block = match.group(1) # Indentación de )}
        indent_close_tag = match.group(2)   # Indentación de </Modal>
        # Retornamos: Indentación del tag + </Modal> + Nueva línea + Indentación del bloque + )}
        return f"{indent_close_tag}</Modal>\n{indent_close_block})}}"

    content, count_modal = re.subn(pattern_modal, swap_modal, content)
    
    if count_modal > 0:
        print(f"✅ FIX 2: Se corrigió el orden de cierre del Modal en {count_modal} lugar(es).")
    else:
        print("ℹ️ FIX 2: No se encontró el modal invertido (ya podría estar arreglado).")

    # Guardar cambios
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    
    print("\n💾 Archivo guardado exitosamente.")

except Exception as e:
    print(f"❌ Error crítico: {e}")
    import traceback
    traceback.print_exc()
