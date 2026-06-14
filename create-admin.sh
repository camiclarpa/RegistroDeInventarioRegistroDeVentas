#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SIGC-Motos v2.0 — Crear Admin (Con Adaptador Prisma v7)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/SIGH_MOTOS"
ENV_FILE="$APP_DIR/.env.production"
APP_CONTAINER="sigc_app"
DB_CONTAINER="sigc_db"
ADMIN_EMAIL="admin@sigcmotos.co"
ADMIN_PASSWORD="Admin2026!"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║      SIGC-Motos — Creación de usuario ADMIN          ║"
echo "╚══════════════════════════════════════════════════════╝"
echo ""

# ── Paso 1: Cargar variables ───────────────────────────────────────
if [[ ! -f "$ENV_FILE" ]]; then echo "❌ .env.production no encontrado"; exit 1; fi

while IFS= read -r line; do
    [[ "$line" =~ ^[[:space:]]*# ]] && continue
    [[ -z "${line//[[:space:]]/}" ]] && continue
    [[ "$line" =~ \<CAMBIAR_ESTO ]] && continue
    [[ "$line" =~ ^[A-Za-z_][A-Za-z0-9_]*= ]] || continue
    export "$line" 2>/dev/null || true
done < "$ENV_FILE"

POSTGRES_USER="${POSTGRES_USER:-sigc_user}"
POSTGRES_DB="${POSTGRES_DB:-sigc_db}"
# Reconstruir DATABASE_URL si no está definida explícitamente pero sí sus partes
if [ -z "${DATABASE_URL:-}" ]; then
    export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@${DB_HOST:-db}:${DB_PORT:-5432}/${POSTGRES_DB}?schema=public"
fi

echo "▶  [1/4] Variables cargadas."

# ── Paso 2: Verificar contenedor ───────────────────────────────────
if ! docker ps --format '{{.Names}}' | grep -q "^${APP_CONTAINER}$"; then
    echo "❌ Contenedor ${APP_CONTAINER} no corre."; exit 1; fi
echo "▶  [2/4] Contenedor OK."

# ── Paso 3: Ejecutar Node.js con Adaptador ─────────────────────────
echo "▶  [3/4] Creando usuario..."

docker exec -i \
    -e DATABASE_URL="$DATABASE_URL" \
    -e SIGC_ADMIN_EMAIL="$ADMIN_EMAIL" \
    -e SIGC_ADMIN_PASSWORD="$ADMIN_PASSWORD" \
    "$APP_CONTAINER" \
    node - << 'NODEJS_CODE'
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

async function main() {
    // Configurar adaptador para Prisma v7
    const pool = new Pool({ connectionString: process.env.DATABASE_URL });
    const adapter = new PrismaPg(pool);
    const prisma = new PrismaClient({ adapter });

    try {
        const ADMIN_EMAIL = process.env.SIGC_ADMIN_EMAIL;
        const ADMIN_PASSWORD = process.env.SIGC_ADMIN_PASSWORD;

        console.log('  [A] Buscando rol ADMIN...');
        let role = await prisma.role.findUnique({ where: { name: 'ADMIN' } });
        
        if (!role) {
            role = await prisma.role.create({ data: { name: 'ADMIN', description: 'Admin Total' } });
            console.log('  ✓ Rol creado:', role.id);
        } else {
            console.log('  ✓ Rol existente:', role.id);
        }

        console.log('  [B] Hasheando contraseña...');
        const hash = await bcrypt.hash(ADMIN_PASSWORD, 10);

        console.log('  [C] Upsert usuario...');
        const user = await prisma.user.upsert({
            where: { email: ADMIN_EMAIL },
            create: {
                email: ADMIN_EMAIL,
                password: hash,
                name: 'Administrador',
                roleId: role.id,
                isActive: true
            },
            update: {
                password: hash,
                name: 'Administrador',
                roleId: role.id,
                isActive: true
            }
        });

        console.log('');
        console.log('  ✅ USUARIO CREADO:');
        console.log('     Email:', user.email);
        console.log('     Pass: ', ADMIN_PASSWORD);
        
    } catch (e) {
        console.error('❌ Error:', e.message);
        process.exit(1);
    } finally {
        await prisma.$disconnect();
        await pool.end();
    }
}
main();
NODEJS_CODE

# ── Paso 4: Verificación SQL ───────────────────────────────────────
echo ""
echo "▶  [4/4] Verificando en BD..."
source .env.production 2>/dev/null || true
docker exec "$DB_CONTAINER" psql -U $POSTGRES_USER -d $POSTGRES_DB -c "SELECT email, name FROM users WHERE email='$ADMIN_EMAIL';"

echo ""
echo "╔══════════════════════════════════════════════════════╗"
echo "║           ✅  PROCESO COMPLETADO                     ║"
echo "╠══════════════════════════════════════════════════════╣"
echo "║  Usa: admin@sigcmotos.co / Admin2026!                ║"
echo "╚══════════════════════════════════════════════════════╝"
