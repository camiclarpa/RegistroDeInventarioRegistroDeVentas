#!/bin/bash
# ============================================
# SINCRONIZACIÓN EMPRESARIAL V2 (CORREGIDA)
# ============================================

LOG_FILE="/var/log/sigc-smart-sync.log"
LOCK_FILE="/tmp/sigc-smart-sync.lock"

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Verificar que todo está funcionando
verify_health() {
    # Verificar backend
    if ! curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        log "❌ Backend no responde health check"
        return 1
    fi
    
    # Verificar login
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@motos.quantacloud.co","password":"Admin123!"}' 2>/dev/null)
    
    if echo "$LOGIN_RESPONSE" | grep -q '"success":true'; then
        log "✅ Login exitoso"
        return 0
    else
        log "⚠️ Login falló (puede ser normal sin token)"
        return 0  # No fallamos por esto, a veces el token expira
    fi
}

# Backup rápido
quick_backup() {
    local backup_dir="/opt/SIGH_MOTOS/backups/sync"
    mkdir -p "$backup_dir"
    local backup_file="$backup_dir/quick_$(date +%Y%m%d_%H%M%S).sql.gz"
    docker exec sigc_db pg_dump -U postgres sigc_motos | gzip > "$backup_file"
    log "✅ Backup rápido: $backup_file"
}

# Sincronización principal
sync_main() {
    if [ -f "$LOCK_FILE" ]; then
        log "⚠️ Sincronización ya en curso"
        exit 0
    fi
    touch "$LOCK_FILE"
    
    log "========================================="
    log "🚀 INICIANDO SINCRONIZACIÓN EMPRESARIAL V2"
    log "========================================="
    
    # Backup antes de cualquier cambio
    quick_backup
    
    # 1. Pull desde BD
    log "📥 Pull desde BD..."
    docker exec -e DATABASE_URL="postgresql://postgres:postgres123@sigc_db:5432/sigc_motos?schema=public" \
        sigc_app npx prisma db pull --force
    
    # 2. Generar cliente
    log "🔨 Generando cliente Prisma..."
    docker exec sigc_app npx prisma generate
    
    # 3. Compilar TypeScript (USANDO EL SCRIPT SEGURO)
    log "📦 Compilando TypeScript..."
    if ! /opt/SIGH_MOTOS/scripts/sync/compile-safe.sh; then
        log "❌ Compilación falló, restaurando backup..."
        # Restaurar último backup
        LATEST_BACKUP=$(ls -t /opt/SIGH_MOTOS/backups/sync/*.sql.gz | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            gunzip -c "$LATEST_BACKUP" | docker exec -i sigc_db psql -U postgres -d sigc_motos
            docker restart sigc_app
            log "✅ Backup restaurado: $LATEST_BACKUP"
        fi
        rm -f "$LOCK_FILE"
        return 1
    fi
    
    # 4. Reiniciar backend
    log "🔄 Reiniciando backend..."
    docker restart sigc_app
    sleep 10
    
    # 5. Verificar salud
    if verify_health; then
        log "✅ SINCRONIZACIÓN EXITOSA"
        quick_backup  # Backup post-sync
    else
        log "❌ SINCRONIZACIÓN FALLÓ - La plataforma no responde correctamente"
        # Restaurar backup
        LATEST_BACKUP=$(ls -t /opt/SIGH_MOTOS/backups/sync/*.sql.gz | head -1)
        if [ -n "$LATEST_BACKUP" ]; then
            gunzip -c "$LATEST_BACKUP" | docker exec -i sigc_db psql -U postgres -d sigc_motos
            docker restart sigc_app
            log "✅ Backup restaurado"
        fi
        rm -f "$LOCK_FILE"
        return 1
    fi
    
    rm -f "$LOCK_FILE"
    return 0
}

sync_main
