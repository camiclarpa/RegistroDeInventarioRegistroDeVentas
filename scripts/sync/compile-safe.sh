#!/bin/bash
# COMPILACIÓN SEGURA DE TYPESCRIPT

cd /opt/SIGH_MOTOS

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1"
}

log "📦 Iniciando compilación segura..."

# Verificar que hay archivos TS
if [ ! -d "src" ]; then
    log "❌ Error: Directorio src no existe"
    exit 1
fi

# Limpiar dist anterior
rm -rf dist
mkdir -p dist

# Ejecutar tsc con parámetros explícitos
log "▶️ Ejecutando tsc..."
docker exec sigc_app sh -c "cd /app && npx tsc --project tsconfig.json 2>&1"

if [ $? -eq 0 ]; then
    log "✅ Compilación exitosa"
    # Verificar que se generó server.js
    if docker exec sigc_app test -f /app/dist/server.js; then
        log "✅ server.js generado correctamente"
    else
        log "❌ server.js NO fue generado"
        exit 1
    fi
else
    log "❌ Compilación falló"
    exit 1
fi
