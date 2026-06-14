import sys
import os

filepath = 'src/pages/Inventory.tsx'
print("🔍 Iniciando restauración estructural...")

try:
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # ==========================================
    # 1. REPARAR FUSIÓN CRÍTICA (~Línea 1315)
    # ==========================================
    fusion_marker = '/>      {/* ─── Modal Gestionar Categorías'
    if fusion_marker in content:
        # Insertar los cierres que faltan: </Modal>, )}, </>
        fixed_fusion = '</Modal>\n      )}\n      </>\n\n      {/* ─── Modal Gestionar Categorías'
        content = content.replace(fusion_marker, fixed_fusion, 1)
        print("✅ Fusión separada y cierres insertados en zona ~1315")
    else:
        print("ℹ️ Marcador de fusión no encontrado (ya podría estar separado)")

    # ==========================================
    # 2. CERRAR MODAL HISTORIAL (~Línea 1155)
    # ==========================================
    # Buscamos el inicio del modal y aseguramos que tenga cierre
    historial_start = '/* ─── Modal Historial de Movimientos'
    if historial_start in content:
        # Verificamos si ya tiene </Modal> después de su contenido
        start_idx = content.find(historial_start)
        # Buscamos el siguiente modal o bloque mayor para encontrar el límite
        next_modal = content.find('/* ─── Modal Gestionar Categorías', start_idx)
        if next_modal != -1:
            segment = content[start_idx:next_modal]
            if '</Modal>' not in segment:
                # Insertar cierre justo antes del siguiente comentario
                content = content[:next_modal] + '</Modal>\n\n' + content[next_modal:]
                print("✅ Cierre </Modal> agregado para Modal Historial")
            else:
                print("✅ Modal Historial ya tiene cierre válido")

    # ==========================================
    # 3. CERRAR FRAGMENT TERNARIO (~Línea 1260)
    # ==========================================
    fragment_marker = '      <>\n            <div className="overflow-x-auto">'
    if fragment_marker in content:
        # Buscar donde debería cerrar (antes del siguiente bloque mayor o comentario)
        frag_start = content.find(fragment_marker)
        # Usamos un enfoque seguro: agregar </> ) si falta antes de la siguiente sección
        if '      </>\n        ) : (' in content or '      </>\n      )}' in content:
            print("✅ Fragment ya tiene cierre")
        else:
            # Insertar cierre seguro después del contenido del fragment
            # Buscamos el siguiente comentario de modal o sección mayor
            next_section = content.find('/* ─── Modal Gestionar Categorías', frag_start)
            if next_section != -1:
                # Insertar antes de ese comentario
                content = content[:next_section] + '      </>\n      )}\n\n' + content[next_section:]
                print("✅ Cierre </> )} agregado para fragment ternario")

    # ==========================================
    # 4. CERRAR DIV RAÍZ (Final del archivo)
    # ==========================================
    if '    </div>\n  )\n}' in content:
        print("✅ Div raíz ya está cerrado correctamente")
    else:
        # Buscar el final y asegurar el cierre
        end_idx = content.rfind('  )\n}')
        if end_idx != -1:
            content = content[:end_idx] + '\n    </div>\n  )\n}'
            print("✅ Cierre </div> del componente raíz asegurado")

    # ==========================================
    # 5. VERIFICAR E INYECTAR BOTÓN VERDE (Acciones)
    # ==========================================
    # Buscamos la columna de acciones y verificamos el botón de etiqueta
    if 'title="Generar etiqueta"' in content or '🏷️' in content:
        print("✅ Botón de generar etiqueta ya existe en Acciones")
    else:
        # Inyectar botón si falta (estructura estándar de tabla)
        print("ℹ️ Botón verde no detectado en columna Acciones. Se recomienda agregar manualmente si no aparece.")

    # ==========================================
    # 6. VERIFICAR GUARDIA DE EDICIÓN
    # ==========================================
    if 'if (selectedProduct?.id) return;' in content:
        print("✅ Guardia de edición presente: No generará códigos aleatorios al editar")
    else:
        print("⚠️ Guardia de edición no encontrada. Se inyectará...")
        # Inyección segura
        target = 'if (catId && name && name.length >= 3) triggerAutoGenerate(catId, brandId, name);'
        if target in content:
            content = content.replace(
                target,
                '// 🛡️ BLOQUEO: No generar si editamos producto existente\n      if (selectedProduct?.id) return;\n      if (catId && name && name.length >= 3) triggerAutoGenerate(catId, brandId, name);'
            )
            print("✅ Guardia inyectada correctamente")

    # Guardar archivo
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(content)
    print("\n💾 Archivo estructural restaurado exitosamente.")

except Exception as e:
    print(f"❌ Error crítico: {e}")
    # Restaurar backup si falla
    if os.path.exists(filepath + '.backup_pre_final_fix'):
        os.replace(filepath + '.backup_pre_final_fix', filepath)
        print("🔄 Archivo restaurado desde backup por seguridad.")
    sys.exit(1)
