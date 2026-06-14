#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SIGC-Motos — Fix Error P3005: Prisma Migrate Baseline (SINTAXIS PRISMA V7)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/SIGH_MOTOS"
cd "$APP_DIR"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      SIGC-Motos — Fix Prisma Baseline (P3005)        ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Paso 1: Asegurar que sigc_app esté corriendo ──────────────────────────────
echo "▶  [1/5] Verificando contenedor sigc_app..."
if ! docker ps | grep -q sigc_app; then
    echo "❌ ERROR: sigc_app no está corriendo. Iniciando servicios..."
    docker compose up -d app db
    sleep 15
    if ! docker ps | grep -q sigc_app; then
        echo "❌ ERROR: sigc_app no pudo iniciar. Revisa logs:"
        docker logs sigc_app --tail 50
        exit 1
    fi
fi
echo "   ✓ sigc_app listo."

# ── Paso 2: Crear carpeta de migraciones si no existe ─────────────────────────
echo ""
echo "▶  [2/5] Preparando estructura de carpetas..."
mkdir -p prisma/migrations/0_init_baseline
echo "   ✓ Carpeta prisma/migrations/0_init_baseline creada."

# ── Paso 3: Generar la migración inicial (SQL) desde sigc_app ─────────────────
echo ""
echo "▶  [3/5] Generando migración inicial (baseline)..."

docker exec -it sigc_app sh -c "
    mkdir -p /app/prisma/migrations/0_init_baseline && \
    npx prisma migrate diff \
        --from-empty \
        --to-schema ./prisma/schema.prisma \
        --script > /app/prisma/migrations/0_init_baseline/migration.sql
"

if [ -f "prisma/migrations/0_init_baseline/migration.sql" ]; then
    echo "   ✓ Migración SQL generada correctamente."
else
    echo "❌ ERROR: No se pudo generar el archivo migration.sql"
    exit 1
fi

# ── Paso 4: Marcar la migración como "Aplicada" (Sin ejecutar SQL) ─────────────
echo ""
echo "▶  [4/5] Marcando migración como aplicada en la BD..."

docker exec -it sigc_app sh -c "
    npx prisma migrate resolve --applied 0_init_baseline
"

echo "   ✓ Migración registrada en _prisma_migrations."

# ── Paso 5: Verificar con Deploy ──────────────────────────────────────────────
echo ""
echo "▶  [5/5] Verificando estado con migrate deploy..."

docker exec -it sigc_app sh -c "
    npx prisma migrate deploy
"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           ✅  BASELINE COMPLETADO                    ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Ahora puedes reiniciar los servicios normales.      ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""
