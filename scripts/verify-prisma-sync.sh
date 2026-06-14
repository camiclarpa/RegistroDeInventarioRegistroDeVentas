#!/bin/bash
# /opt/SIGH_MOTOS/scripts/verify-prisma-sync.sh
# Verifica sincronización entre schema.prisma y PostgreSQL

set -e

echo "═══════════════════════════════════════════════════════════"
echo "🔍 VERIFICADOR: Prisma Schema ↔ PostgreSQL"
echo "═══════════════════════════════════════════════════════════"
echo "Fecha: $(date)"
echo ""

SCHEMA_FILE="/opt/SIGH_MOTOS/prisma/schema.prisma"
DB_NAME="sigc_motos"
DB_USER="postgres"
DB_CONTAINER="sigc_db"

# ═══════════════════════════════════════════════════════════════
# FUNCIÓN: Extraer modelos y campos del schema.prisma (cat + grep)
# ═══════════════════════════════════════════════════════════════
get_schema_fields() {
    local model=$1
    # Extraer bloque del modelo y filtrar líneas de campos (ignorar @id, @relation, etc.)
    sed -n "/^model $model {/,/^}/p" "$SCHEMA_FILE" 2>/dev/null | \
    grep -E "^\s+\w+\s+\w+" | \
    grep -v "@relation\|@@index\|@@map\|@@unique" | \
    awk '{print $1}' | \
    sed 's/?$//'  # Quitar ? de campos opcionales
}

# ═══════════════════════════════════════════════════════════════
# FUNCIÓN: Obtener columnas reales de la BD (psql + grep)
# ═══════════════════════════════════════════════════════════════
get_db_columns() {
    local table=$1
    docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema='public' AND table_name='$table'
        ORDER BY ordinal_position;
    " 2>/dev/null | tr -d ' ' | grep -v "^$"
}

# ═══════════════════════════════════════════════════════════════
# FUNCIÓN: Comparar y reportar diferencias
# ═══════════════════════════════════════════════════════════════
compare_model() {
    local model=$1
    local table=$2  # Nombre real en BD (puede diferir por @@map)
    
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    echo "📊 Comparando: $model ↔ $table"
    echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
    
    # Obtener campos de ambas fuentes
    SCHEMA_FIELDS=$(get_schema_fields "$model" | sort)
    DB_FIELDS=$(get_db_columns "$table" | sort)
    
    # Campos en schema pero NO en BD ❌
    echo ""
    echo "❌ En schema.prisma pero NO en la BD:"
    comm -23 <(echo "$SCHEMA_FIELDS") <(echo "$DB_FIELDS") 2>/dev/null | sed 's/^/   • /' || echo "   ✅ Ninguno"
    
    # Campos en BD pero NO en schema ❌
    echo ""
    echo "❌ En la BD pero NO en schema.prisma:"
    comm -13 <(echo "$SCHEMA_FIELDS") <(echo "$DB_FIELDS") 2>/dev/null | sed 's/^/   • /' || echo "   ✅ Ninguno"
    
    # Campos que coinciden ✅
    MATCH=$(comm -12 <(echo "$SCHEMA_FIELDS") <(echo "$DB_FIELDS") 2>/dev/null | wc -l)
    echo ""
    echo "✅ Campos sincronizados: $MATCH"
}

# ═══════════════════════════════════════════════════════════════
# MAIN: Lista de modelos críticos a verificar
# ═══════════════════════════════════════════════════════════════
echo "📋 Modelos a verificar:"
echo ""

# Definir mapeo: ModelName -> table_name_en_bd
# (usa @@map si existe, sino asume que son iguales)
declare -A MODEL_MAP
MODEL_MAP["User"]="users"
MODEL_MAP["Product"]="products"
MODEL_MAP["Brand"]="brands"
MODEL_MAP["Category"]="categories"
MODEL_MAP["Customer"]="customers"
MODEL_MAP["Sale"]="sales"
MODEL_MAP["SaleItem"]="sale_items"
MODEL_MAP["InventoryMovement"]="inventory_movements"
MODEL_MAP["Role"]="roles"

# Verificar cada modelo
for model in "${!MODEL_MAP[@]}"; do
    table="${MODEL_MAP[$model]}"
    
    # Verificar que el modelo existe en schema
    if grep -q "^model $model {" "$SCHEMA_FILE" 2>/dev/null; then
        # Verificar que la tabla existe en BD
        TABLE_EXISTS=$(docker exec "$DB_CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -t -c "
            SELECT EXISTS (SELECT FROM pg_tables WHERE schemaname='public' AND tablename='$table');
        " 2>/dev/null | tr -d ' ')
        
        if [ "$TABLE_EXISTS" = "t" ]; then
            compare_model "$model" "$table"
        else
            echo "⚠️  Modelo '$model' definido en schema, pero tabla '$table' NO existe en BD"
        fi
    else
        echo "⚠️  Tabla '$table' existe en BD, pero modelo '$model' NO está en schema.prisma"
    fi
    echo ""
done

# ═══════════════════════════════════════════════════════════════
# RESUMEN FINAL
# ═══════════════════════════════════════════════════════════════
echo "═══════════════════════════════════════════════════════════"
echo "📈 RESUMEN DE SINCRONIZACIÓN"
echo "═══════════════════════════════════════════════════════════"

# Contar discrepancias globales
TOTAL_MISMATCH=0
for model in "${!MODEL_MAP[@]}"; do
    table="${MODEL_MAP[$model]}"
    if grep -q "^model $model {" "$SCHEMA_FILE" 2>/dev/null; then
        SCHEMA_F=$(get_schema_fields "$model" | wc -l)
        DB_F=$(get_db_columns "$table" 2>/dev/null | wc -l)
        if [ "$SCHEMA_F" != "$DB_F" ]; then
            TOTAL_MISMATCH=$((TOTAL_MISMATCH + 1))
        fi
    fi
done

if [ "$TOTAL_MISMATCH" -eq 0 ]; then
    echo "✅ ¡Todos los modelos críticos están sincronizados!"
    echo ""
    echo "🎯 Tu plataforma está lista para producción."
else
    echo "⚠️  Se detectaron $TOTAL_MISMATCH modelos con discrepancias."
    echo ""
    echo "🔧 Para sincronizar:"
    echo "   1. Ejecuta: npx prisma db pull --force"
    echo "   2. O ajusta manualmente schema.prisma según el reporte"
    echo "   3. Luego: npx prisma generate && docker restart sigc_app"
fi

echo ""
echo "═══════════════════════════════════════════════════════════"
