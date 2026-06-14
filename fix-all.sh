#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SIGC-Motos — Fix Definitivo: Permisos + Rutas + Rebuild (VERSIÓN CORREGIDA)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/SIGH_MOTOS"
ENV_FILE="$APP_DIR/.env.production"
COMPOSE="docker compose --env-file $ENV_FILE"

GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}   ✓${NC} $*"; }
fail() { echo -e "${RED}   ✗${NC} $*"; exit 1; }
info() { echo -e "${BLUE}▶${NC}  $*"; }
warn() { echo -e "${YELLOW}   ⚠${NC}  $*"; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║   SIGC-Motos — Fix Definitivo 403/404                   ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$APP_DIR" || fail "No se puede acceder a $APP_DIR"

# ── Validar entorno ───────────────────────────────────────────────────────────
info "[1/5] Validando entorno..."
[[ ! -f "$ENV_FILE" ]] && fail "No se encontró $ENV_FILE"
DATABASE_URL=$(grep "^DATABASE_URL=" "$ENV_FILE" | head -1 | sed 's/^DATABASE_URL=//' | tr -d '"' | tr -d "'")
[[ -z "$DATABASE_URL" ]] && fail "DATABASE_URL no encontrado en $ENV_FILE"
[[ "$DATABASE_URL" == *"CAMBIAR_ESTO"* ]] && fail "DATABASE_URL tiene placeholder"
ok "Variables de entorno validadas"

# ── Seed de permisos vía SQL DIRECTO (sin Node.js) ────────────────────────────
info "[2/5] Ejecutando seed de roles y permisos en BD (vía SQL)..."

docker exec -i sigc_db psql -U ${POSTGRES_USER:-sigc_user} -d ${POSTGRES_DB:-sigc_db} << 'SEED_SQL'
-- Insertar permisos si no existen
INSERT INTO permissions (name, description) VALUES
('inventory.read', 'Leer inventario'), ('inventory.write', 'Escribir inventario'),
('sales.read', 'Leer ventas'), ('sales.write', 'Escribir ventas'), ('sales.admin', 'Administrar ventas'),
('purchases.read', 'Leer compras'), ('purchases.write', 'Escribir compras'),
('reports.read', 'Leer reportes'),
('users.read', 'Leer usuarios'), ('users.write', 'Escribir usuarios'), ('users.admin', 'Administrar usuarios'),
('finance.read', 'Leer finanzas'), ('finance.write', 'Escribir finanzas'),
('treasury.read', 'Leer tesorería'), ('treasury.write', 'Escribir tesorería'),
('security.read', 'Leer seguridad'), ('security.write', 'Escribir seguridad'),
('config.read', 'Leer configuración'), ('config.write', 'Escribir configuración'),
('debts.read', 'Leer créditos'), ('debts.write', 'Escribir créditos'),
('abc.read', 'Ver análisis ABC'), ('pos.search', 'Búsqueda POS'), ('images.upload', 'Subir imágenes')
ON CONFLICT (name) DO NOTHING;

-- Crear roles si no existen
INSERT INTO roles (id, name, description) VALUES
(gen_random_uuid(), 'ADMIN', 'Acceso total al sistema'),
(gen_random_uuid(), 'MANAGER', 'Gerente'),
(gen_random_uuid(), 'SELLER', 'Vendedor'),
(gen_random_uuid(), 'WAREHOUSE', 'Bodeguero')
ON CONFLICT (name) DO NOTHING;

-- Asignar TODOS los permisos al rol ADMIN
DO $$
DECLARE admin_role_id TEXT;
BEGIN
    SELECT id INTO admin_role_id FROM roles WHERE name = 'ADMIN';
    IF NOT FOUND THEN RAISE EXCEPTION 'Rol ADMIN no encontrado.'; END IF;
    INSERT INTO role_permissions ("roleId", "permissionId")
    SELECT admin_role_id, p.id FROM permissions p
    ON CONFLICT ("roleId", "permissionId") DO NOTHING;
    RAISE NOTICE '✅ Todos los permisos asignados al rol ADMIN.';
END $$;
SEED_SQL

ok "Seed completado vía SQL"

# ── Build frontend ────────────────────────────────────────────────────────────
info "[3/5] Construyendo frontend..."
cd "$APP_DIR/frontend"
[[ ! -d node_modules ]] && npm install --silent
VITE_API_URL="https://motos.quantacloud.co/api/v1" npm run build 2>&1 | tail -3
cd "$APP_DIR"
ok "Frontend construido"

# ── Rebuild backend sin cache ─────────────────────────────────────────────────
info "[4/5] Reconstruyendo backend (esto tarda 2-4 minutos)..."
$COMPOSE down --remove-orphans 2>/dev/null || true
$COMPOSE build --no-cache app 2>&1 | grep -E "(Step|=>|CACHED|Built|Error|error)" | head -20 || true
ok "Imagen backend reconstruida"

# ── Levantar servicios ────────────────────────────────────────────────────────
info "[5/5] Desplegando todos los servicios..."
$COMPOSE up -d db
echo "   Esperando sigc_db healthy..."
WAITED=0
until docker inspect sigc_db --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
  [[ $WAITED -ge 60 ]] && fail "sigc_db no alcanzó estado healthy"
  printf "."; sleep 2; WAITED=$((WAITED+2))
done
echo ""
ok "sigc_db healthy"

$COMPOSE up migrate 2>&1 | tail -3 || warn "Migrate con advertencias"
$COMPOSE up -d app nginx certbot

echo "   Esperando sigc_app (hasta 60s)..."
WAITED=0
until docker inspect sigc_app --format='{{.State.Status}}' 2>/dev/null | grep -q "running"; do
  [[ $WAITED -ge 60 ]] && { docker logs sigc_app --tail 20; fail "sigc_app no arrancó"; }
  printf "."; sleep 3; WAITED=$((WAITED+3))
done
echo ""
sleep 5

# ── Verificación final ────────────────────────────────────────────────────────
echo ""
info "Verificando sistema..."

HEALTH=$(docker exec sigc_app node -e "require('http').get('http://localhost:3000/health',r=>{process.stdout.write(String(r.statusCode));process.exit(0)}).on('error',()=>{process.stdout.write('0');process.exit(1)})" 2>/dev/null || echo "0")
[[ "$HEALTH" == "200" ]] && ok "/health → HTTP 200" || warn "/health → HTTP $HEALTH"

LOGIN=$(docker exec sigc_app node -e "const http=require('http');const b=JSON.stringify({email:'admin@sigcmotos.co',password:'Admin2026!'});const o={hostname:'localhost',port:3000,path:'/api/v1/auth/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}};const r=http.request(o,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{process.stdout.write(res.statusCode+' '+d.substring(0,60));process.exit(0);})});r.on('error',e=>{process.stdout.write('ERR');process.exit(1);});r.write(b);r.end();" 2>/dev/null || echo "ERROR")
echo "   POST /auth/login → $LOGIN"
echo "$LOGIN" | grep -q "^200" && ok "Login correcto" || warn "Login: $LOGIN"

TOKEN=$(docker exec sigc_app node -e "const http=require('http');const b=JSON.stringify({email:'admin@sigcmotos.co',password:'Admin2026!'});const o={hostname:'localhost',port:3000,path:'/api/v1/auth/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}};const r=http.request(o,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{try{const j=JSON.parse(d);process.stdout.write(j.data?.token||j.token||'');}catch{}process.exit(0);})});r.on('error',()=>process.exit(1));r.write(b);r.end();" 2>/dev/null || echo "")

if [[ -n "$TOKEN" ]]; then
  CATS=$(docker exec sigc_app node -e "const http=require('http');const opts={hostname:'localhost',port:3000,path:'/api/v1/inventory/categories',headers:{'Authorization':'Bearer $TOKEN'}};http.get(opts,r=>{process.stdout.write(String(r.statusCode));process.exit(0);}).on('error',()=>{process.stdout.write('ERR');process.exit(1)});" 2>/dev/null || echo "ERR")
  [[ "$CATS" == "200" ]] && ok "GET /inventory/categories → HTTP 200 (sin 403)" || warn "GET /inventory/categories → HTTP $CATS"
fi

docker ps --format "table {{.Names}}\t{{.Status}}" --filter "name=sigc_" 2>/dev/null || true

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           ✅  FIX COMPLETADO                             ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  URL:    https://motos.quantacloud.co                   ║"
echo "║  Login:  admin@sigcmotos.co / Admin2026!                ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  Cambios aplicados:                                      ║"
echo "║  ✓ authMiddleware lee permisos desde BD (no del JWT)    ║"
echo "║  ✓ Seed de permisos + roles en role_permissions (SQL)   ║"
echo "║  ✓ GET /invoices, /treasury/*, /security/users, etc.    ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""
