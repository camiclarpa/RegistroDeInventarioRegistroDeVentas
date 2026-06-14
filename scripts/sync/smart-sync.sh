#!/bin/bash
# ============================================
# SINCRONIZACIÓN INTELIGENTE (EMPRESARIAL)
# ============================================

LOG_FILE="/var/log/sigc-smart-sync.log"
LOCK_FILE="/tmp/sigc-smart-sync.lock"
CONFIG_FILE="/opt/SIGH_MOTOS/scripts/sync/sync.conf"

# Configuración por defecto
AUTO_FIX=${AUTO_FIX:-true}
BACKUP_BEFORE_SYNC=${BACKUP_BEFORE_SYNC:-true}
NOTIFY_ON_ERROR=${NOTIFY_ON_ERROR:-true}
MAX_RETRIES=3

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Verificar condiciones de seguridad
check_safety() {
    # Verificar que hay espacio en disco
    DISK_SPACE=$(df /opt/SIGH_MOTOS | awk 'NR==2 {print $4}')
    if [ "$DISK_SPACE" -lt 1048576 ]; then
        log "❌ ERROR: Espacio en disco insuficiente (<1GB)"
        return 1
    fi
    
    # Verificar que los contenedores están sanos
    if ! docker ps --filter "name=sigc_db" --filter "status=running" | grep -q sigc_db; then
        log "❌ ERROR: Base de datos no está corriendo"
        return 1
    fi
    
    if ! docker ps --filter "name=sigc_app" --filter "status=running" | grep -q sigc_app; then
        log "❌ ERROR: Backend no está corriendo"
        return 1
    fi
    
    return 0
}

# Backup con rotación
do_backup() {
    local backup_type=$1
    local backup_dir="/opt/SIGH_MOTOS/backups/sync"
    mkdir -p "$backup_dir"
    
    local backup_file="$backup_dir/${backup_type}_$(date +%Y%m%d_%H%M%S).sql.gz"
    
    log "📦 Creando backup: $backup_file"
    docker exec sigc_db pg_dump -U postgres sigc_motos | gzip > "$backup_file"
    
    # Mantener solo últimos 10 backups por tipo
    ls -t "$backup_dir"/${backup_type}_*.sql.gz 2>/dev/null | tail -n +11 | xargs rm -f 2>/dev/null
    
    echo "$backup_file"
}

# Verificar si los cambios son seguros
validate_changes() {
    local changes=$1
    
    # Lista negra de cambios peligrosos
    DANGEROUS_PATTERNS=(
        "DROP SCHEMA"
        "DROP DATABASE"
        "DROP TABLE.*users"
        "DROP TABLE.*products"
        "ALTER TABLE.*DROP COLUMN.*id"
    )
    
    for pattern in "${DANGEROUS_PATTERNS[@]}"; do
        if echo "$changes" | grep -qi "$pattern"; then
            log "🚨 BLOQUEADO: Cambio peligroso detectado: $pattern"
            return 1
        fi
    done
    
    return 0
}

# Estrategia de sincronización
sync_strategy() {
    local strategy=$1
    local retry=0
    
    while [ $retry -lt $MAX_RETRIES ]; do
        case $strategy in
            "pull")
                log "📥 Estrategia: Pull (BD → Schema)"
                docker exec -e DATABASE_URL="postgresql://postgres:postgres123@sigc_db:5432/sigc_motos?schema=public" \
                    sigc_app npx prisma db pull --force
                ;;
            "push")
                log "📤 Estrategia: Push (Schema → BD)"
                docker exec sigc_app npx prisma db push --accept-data-loss
                ;;
            "migrate")
                log "🔄 Estrategia: Migrate"
                docker exec sigc_app npx prisma migrate deploy
                ;;
            *)
                log "❌ Estrategia desconocida: $strategy"
                return 1
                ;;
        esac
        
        if [ $? -eq 0 ]; then
            return 0
        fi
        
        retry=$((retry + 1))
        log "⚠️ Intento $retry falló, reintentando..."
        sleep 5
    done
    
    return 1
}

# Regenerar cliente y recompilar
rebuild_client() {
    log "🔨 Regenerando cliente Prisma..."
    docker exec sigc_app npx prisma generate
    
    log "📦 Recompilando TypeScript..."
    docker exec sigc_app npx tsc
    
    log "🔄 Reiniciando backend..."
    docker restart sigc_app
    sleep 10
}

# Verificar que la sincronización funcionó
verify_sync() {
    local max_wait=30
    local waited=0
    
    while [ $waited -lt $max_wait ]; do
        if docker exec sigc_app npx prisma validate 2>&1 | grep -q "valid"; then
            log "✅ Validación exitosa"
            return 0
        fi
        sleep 2
        waited=$((waited + 2))
    done
    
    log "❌ Validación falló"
    return 1
}

# Ejecutar sincronización completa
main() {
    # Evitar ejecución concurrente
    if [ -f "$LOCK_FILE" ]; then
        log "⚠️ Sincronización ya en curso"
        exit 0
    fi
    touch "$LOCK_FILE"
    
    log "========================================="
    log "🚀 INICIANDO SINCRONIZACIÓN EMPRESARIAL"
    log "========================================="
    
    # 1. Verificar condiciones de seguridad
    if ! check_safety; then
        log "❌ Condiciones de seguridad no cumplidas"
        rm -f "$LOCK_FILE"
        exit 1
    fi
    
    # 2. Detectar cambios
    CHANGE_STATUS=$(/opt/SIGH_MOTOS/scripts/sync/detect-changes.sh)
    log "Estado: $CHANGE_STATUS"
    
    if [ "$CHANGE_STATUS" = "SYNCED" ]; then
        log "✅ No hay cambios, sincronización no necesaria"
        rm -f "$LOCK_FILE"
        exit 0
    fi
    
    # 3. Backup antes de sincronizar
    if [ "$BACKUP_BEFORE_SYNC" = "true" ]; then
        BACKUP_FILE=$(do_backup "pre_sync")
        log "✅ Backup creado: $BACKUP_FILE"
    fi
    
    # 4. Estrategia de sincronización (primero pull)
    if ! sync_strategy "pull"; then
        log "❌ Pull falló, intentando estrategia alternativa..."
        if ! sync_strategy "push"; then
            log "❌ Push también falló"
            rm -f "$LOCK_FILE"
            return 1
        fi
    fi
    
    # 5. Reconstruir cliente
    rebuild_client
    
    # 6. Verificar
    if verify_sync; then
        log "✅ SINCRONIZACIÓN EXITOSA"
        
        # Backup post-sync
        if [ "$BACKUP_BEFORE_SYNC" = "true" ]; then
            do_backup "post_sync"
        fi
    else
        log "❌ SINCRONIZACIÓN FALLÓ"
        
        # Restaurar backup si existe
        if [ -n "$BACKUP_FILE" ] && [ -f "$BACKUP_FILE" ]; then
            log "🔄 Restaurando backup..."
            gunzip -c "$BACKUP_FILE" | docker exec -i sigc_db psql -U postgres -d sigc_motos
            docker restart sigc_app
        fi
        
        rm -f "$LOCK_FILE"
        return 1
    fi
    
    rm -f "$LOCK_FILE"
    return 0
}

main

# Verificación post-sincronización (login test)
verify_login() {
    log "🔐 Probando login post-sincronización..."
    
    LOGIN_RESPONSE=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
        -H "Content-Type: application/json" \
        -d '{"email":"admin@motos.quantacloud.co","password":"Admin123!"}')
    
    SUCCESS=$(echo "$LOGIN_RESPONSE" | jq -r '.success')
    
    if [ "$SUCCESS" = "true" ]; then
        log "✅ Login exitoso post-sincronización"
        return 0
    else
        log "❌ Login falló post-sincronización"
        log "📝 Respuesta: $LOGIN_RESPONSE"
        return 1
    fi
}

# Agregar verificación de login al final del main
# (Insertar antes de la línea que hace rm -f $LOCK_FILE)
