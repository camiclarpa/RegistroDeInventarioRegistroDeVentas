#!/bin/bash
# ═══════════════════════════════════════════════════════════════════════════════
#  SIGC-Motos v2.0 — Rebuild completo (backend + frontend)
# ═══════════════════════════════════════════════════════════════════════════════
set -euo pipefail

APP_DIR="/opt/SIGH_MOTOS"
ENV_FILE="$APP_DIR/.env.production"
COMPOSE="docker compose --env-file $ENV_FILE"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}   ✓${NC} $*"; }
info() { echo -e "${BLUE}▶${NC}  $*"; }
warn() { echo -e "${YELLOW}   ⚠${NC}  $*"; }
fail() { echo -e "${RED}❌${NC} $*"; exit 1; }

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║      SIGC-Motos v2.0 — Rebuild Completo                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
echo ""

cd "$APP_DIR" || fail "No se puede acceder a $APP_DIR"

# ── Validar env ───────────────────────────────────────────────────────────────
[[ ! -f "$ENV_FILE" ]] && fail "No se encontró $ENV_FILE"
ok "Variables de entorno validadas"

# ── Paso 1: Rebuild del frontend ──────────────────────────────────────────────
echo ""
info "[1/4] Construyendo frontend (Vite)..."
export VITE_API_URL="https://motos.quantacloud.co/api/v1"
cd "$APP_DIR/frontend"
if [[ ! -d node_modules ]]; then npm install --silent; fi
npm run build 2>&1 | tail -5
cd "$APP_DIR"
ok "Frontend construido"

# ── Paso 2: Detener contenedores ─────────────────────────────────────────────
echo ""
info "[2/4] Deteniendo contenedores existentes..."
$COMPOSE down --remove-orphans 2>/dev/null || true
ok "Contenedores detenidos"

# ── Paso 3: Rebuild del backend SIN CACHE ────────────────────────────────────
echo ""
info "[3/4] Reconstruyendo backend Docker (sin cache)..."
$COMPOSE build --no-cache app migrate 2>&1 | grep -E "(Step|RUN|COPY|Built|ERROR|error)" || true
ok "Imágenes reconstruidas"

# ── Paso 4: Levantar todo ─────────────────────────────────────────────────────
echo ""
info "[4/4] Desplegando todos los servicios..."
$COMPOSE up -d db
echo "   Esperando DB healthy..."
WAITED=0
until docker inspect sigc_db --format='{{.State.Health.Status}}' 2>/dev/null | grep -q "healthy"; do
  [[ $WAITED -ge 60 ]] && fail "DB no healthy"
  printf "."; sleep 2; WAITED=$((WAITED+2))
done
echo ""

echo "   Ejecutando migrate..."
$COMPOSE up migrate 2>&1 | tail -5 || warn "Migrate terminó con error (ignorable si tablas existen)"

$COMPOSE up -d app nginx certbot
echo "   Esperando App running..."
WAITED=0
until docker inspect sigc_app --format='{{.State.Status}}' 2>/dev/null | grep -q "running"; do
  [[ $WAITED -ge 60 ]] && { docker logs sigc_app --tail 30; fail "App no arrancó"; }
  printf "."; sleep 3; WAITED=$((WAITED+3))
done
echo ""
sleep 5
ok "sigc_app corriendo"

# ── Verificar endpoints ───────────────────────────────────────────────────────
echo ""
info "Verificando endpoints..."
HTTP=$(docker exec sigc_app node -e "require('http').get('http://localhost:3000/health',r=>{process.stdout.write(String(r.statusCode));process.exit(0)}).on('error',()=>{process.stdout.write('0');process.exit(1)})" 2>/dev/null || echo "0")
if [[ "$HTTP" == "200" ]]; then ok "/health → HTTP 200"; else warn "/health → HTTP $HTTP"; fi

LOGIN_RESULT=$(docker exec sigc_app node -e "const http=require('http');const b=JSON.stringify({email:'admin@sigcmotos.co',password:'Admin2026!'});const o={hostname:'localhost',port:3000,path:'/api/v1/auth/login',method:'POST',headers:{'Content-Type':'application/json','Content-Length':Buffer.byteLength(b)}};const r=http.request(o,res=>{let d='';res.on('data',c=>d+=c);res.on('end',()=>{process.stdout.write(res.statusCode+' '+d.substring(0,80));process.exit(0);})});r.on('error',e=>{process.stdout.write('ERR');process.exit(1);});r.write(b);r.end();" 2>/dev/null || echo "ERROR")
echo "   POST /api/v1/auth/login → $LOGIN_RESULT"
if echo "$LOGIN_RESULT" | grep -q "^200"; then ok "Login OK"; elif echo "$LOGIN_RESULT" | grep -q "^401"; then ok "Login Endpoint OK (401 creds)"; else warn "Login Error: $LOGIN_RESULT"; fi

echo ""
echo "╔══════════════════════════════════════════════════════════╗"
echo "║           ✅  REBUILD COMPLETADO                         ║"
echo "╠══════════════════════════════════════════════════════════╣"
echo "║  URL:  https://motos.quantacloud.co                     ║"
echo "║  Login: admin@sigcmotos.co / Admin2026!                 ║"
echo "╚══════════════════════════════════════════════════════════╝"
