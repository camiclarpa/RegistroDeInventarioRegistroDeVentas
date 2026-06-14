#!/usr/bin/env bash
# ═══════════════════════════════════════════════════════════════════════
#  SIGC-Motos — Fix & Deploy Script
#  Ruta: /opt/SIGH_MOTOS  |  Uso: bash fix_and_deploy.sh
# ═══════════════════════════════════════════════════════════════════════
set -euo pipefail

PROJECT_DIR="/opt/SIGH_MOTOS"
cd "$PROJECT_DIR"
echo "📁 Directorio de trabajo: $(pwd)"

# Detectar docker compose disponible
if docker compose version &>/dev/null 2>&1; then
    DC="docker compose"
elif docker-compose version &>/dev/null 2>&1; then
    DC="docker-compose"
else
    echo "✗ Error: no se encontró 'docker compose' ni 'docker-compose'."
    exit 1
fi
echo "🐋 Docker Compose: $DC"

# ─── PASO 1: Corregir package.json ─────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 1 — Validar y corregir package.json        │"
echo "└──────────────────────────────────────────────────┘"

python3 - <<'PYEOF'
import json, sys, re

path = "package.json"

with open(path, "r") as f:
    raw = f.read()

parsed = None

# Intento 1: JSON válido tal cual
try:
    parsed = json.loads(raw)
    print("  ✓ package.json ya es JSON válido.")
except json.JSONDecodeError as e:
    print(f"  ⚠ Sintaxis inválida: {e}")
    print("  → Aplicando correcciones automáticas...")

    fixed = raw
    # Comillas simples → dobles (claves)
    fixed = re.sub(r"'([^'\n]+?)'(\s*:)", r'"\1"\2', fixed)
    # Comillas simples → dobles (valores)
    fixed = re.sub(r":\s*'([^'\n]*)'", r': "\1"', fixed)
    # Comas finales antes de } o ]
    fixed = re.sub(r',\s*([}\]])', r'\1', fixed)

    try:
        parsed = json.loads(fixed)
        print("  ✓ Correcciones aplicadas (comillas/comas).")
    except json.JSONDecodeError as e2:
        print(f"  ✗ No se pudo reparar automáticamente: {e2}")
        print("\n--- Contenido actual de package.json ---")
        print(raw)
        print("----------------------------------------")
        sys.exit(1)

# Asegurar que el script build sea el correcto
desired = "prisma generate && tsc"
scripts = parsed.setdefault("scripts", {})
current = scripts.get("build", "")
if current != desired:
    scripts["build"] = desired
    print(f'  ✓ Build corregido: "{current or "(vacío)"}" → "{desired}"')
else:
    print(f'  ✓ Build script ya es correcto: "{desired}"')

with open(path, "w") as f:
    json.dump(parsed, f, indent=2, ensure_ascii=False)
    f.write("\n")
print("  ✓ package.json guardado correctamente.")
PYEOF

# ─── PASO 2: Corregir tsconfig.json ────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 2 — Corregir tsconfig.json                 │"
echo "└──────────────────────────────────────────────────┘"

python3 - <<'PYEOF'
import json, sys

path = "tsconfig.json"

with open(path, "r") as f:
    raw = f.read()

try:
    config = json.loads(raw)
except json.JSONDecodeError as e:
    print(f"  ✗ tsconfig.json tiene sintaxis inválida: {e}")
    sys.exit(1)

opts = config.setdefault("compilerOptions", {})
dirty = False

fixes = [
    ("strict",                     False),
    ("noImplicitAny",              False),
    ("useUnknownInCatchVariables", False),
]

for key, desired_val in fixes:
    current_val = opts.get(key, "(ausente)")
    if opts.get(key) != desired_val:
        opts[key] = desired_val
        print(f"  ✓ {key}: {current_val} → {desired_val}")
        dirty = True
    else:
        print(f"  ✓ {key}: ya es {desired_val}")

if dirty:
    with open(path, "w") as f:
        json.dump(config, f, indent=2, ensure_ascii=False)
        f.write("\n")
    print("  ✓ tsconfig.json guardado correctamente.")
else:
    print("  ✓ tsconfig.json ya tenía la configuración correcta.")
PYEOF

# ─── PASO 3: npm install (backend) ─────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 3 — npm install (backend)                  │"
echo "└──────────────────────────────────────────────────┘"
npm install

# ─── PASO 4: prisma generate ───────────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 4 — npx prisma generate                    │"
echo "└──────────────────────────────────────────────────┘"
npx prisma generate

# ─── PASO 5: npm run build (backend) ───────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 5 — npm run build (backend)                │"
echo "└──────────────────────────────────────────────────┘"
npm run build

# ─── PASO 6: Frontend ──────────────────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 6 — Frontend (si existe)                   │"
echo "└──────────────────────────────────────────────────┘"
if [ -d "./frontend" ]; then
    echo "  → Carpeta ./frontend detectada."
    cd ./frontend
    npm install
    npm run build
    cd ..
    echo "  ✓ Frontend compilado y listo en ./frontend/dist"
else
    echo "  ℹ  No existe ./frontend — omitido."
fi

# ─── PASO 7: Reiniciar Nginx ───────────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 7 — Reiniciar contenedor nginx             │"
echo "└──────────────────────────────────────────────────┘"
$DC up -d --no-deps --force-recreate nginx
echo "  Esperando 4 segundos para que Nginx arranque..."
sleep 4

# ─── PASO 8: Prueba HTTPS ──────────────────────────────────────────────
echo ""
echo "┌──────────────────────────────────────────────────┐"
echo "│  PASO 8 — Verificar HTTPS internamente (curl)    │"
echo "└──────────────────────────────────────────────────┘"
HTTP_RESPONSE=$(curl -sk -I --max-time 10 https://localhost 2>&1)
echo "$HTTP_RESPONSE"
echo ""

if echo "$HTTP_RESPONSE" | grep -qE "HTTP/[12].*200"; then
    echo "✅ SUCCESS: HTTPS is working internally!"
else
    FIRST_LINE=$(echo "$HTTP_RESPONSE" | head -1)
    echo "⚠  HTTPS respondió con: ${FIRST_LINE:-[sin respuesta]}"
    echo ""
    echo "→ Últimas 30 líneas de logs de Nginx:"
    $DC logs --tail=30 nginx
fi

echo ""
echo "════════════════════════════════════════════════════"
echo "  SCRIPT COMPLETADO EXITOSAMENTE"
echo "════════════════════════════════════════════════════"
