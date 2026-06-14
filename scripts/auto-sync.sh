#!/bin/bash
# ============================================
# SINCRONIZACIÓN AUTOMÁTICA PRISMA ↔ BD
# ============================================

LOG_FILE="/var/log/sigc-sync.log"
SYNC_LOCK="/tmp/sigc-sync.lock"

# Evitar ejecuciones concurrentes
if [ -f "$SYNC_LOCK" ]; then
    echo "[$(date)] ⚠️ Sincronización ya en curso" >> $LOG_FILE
    exit 0
fi
touch $SYNC_LOCK

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Verificar que el backend está corriendo
check_backend() {
    if ! docker ps --filter "name=sigc_app" --filter "status=running" | grep -q sigc_app; then
        log "❌ Backend no está corriendo"
        rm -f $SYNC_LOCK
        exit 1
    fi
}

# Verificar que la base de datos está corriendo
check_db() {
    if ! docker ps --filter "name=sigc_db" --filter "status=running" | grep -q sigc_db; then
        log "❌ Base de datos no está corriendo"
        rm -f $SYNC_LOCK
        exit 1
    fi
}

# Comparar esquemas (si hay diferencias)
check_schema_diff() {
    # Generar schema actual de la BD
    docker exec sigc_db pg_dump -U postgres --schema-only sigc_motos > /tmp/current_schema.sql 2>/dev/null
    
    # Verificar si hay diferencias con el schema.prisma
    # (Simplificado - en realidad Prisma tiene su propio mecanismo)
    docker exec sigc_app npx prisma migrate status > /tmp/migrate_status.txt 2>&1
    
    if grep -q "Database schema is up to date" /tmp/migrate_status.txt; then
        return 0  # Sincronizado
    else
        return 1  # Desincronizado
    fi
}

# Ejecutar sincronización
do_sync() {
    log "🔄 Iniciando sincronización Prisma ↔ BD"
    
    # Backup antes de sincronizar
    BACKUP_FILE="/opt/SIGH_MOTOS/backups/pre_sync_$(date +%Y%m%d_%H%M%S).sql.gz"
    docker exec sigc_db pg_dump -U postgres sigc_motos | gzip > $BACKUP_FILE
    log "✅ Backup creado: $BACKUP_FILE"
    
    # Opción 1: Si la BD tiene cambios, actualizar schema.prisma
    log "📥 Actualizando schema.prisma desde la BD..."
    docker exec -e DATABASE_URL="postgresql://postgres:postgres123@sigc_db:5432/sigc_motos?schema=public" \
        sigc_app npx prisma db pull --force >> $LOG_FILE 2>&1
    
    # Opción 2: Regenerar cliente Prisma
    log "🔨 Regenerando cliente Prisma..."
    docker exec sigc_app npx prisma generate >> $LOG_FILE 2>&1
    
    # Opción 3: Recompilar TypeScript
    log "📦 Recompilando TypeScript..."
    docker exec sigc_app npm run build >> $LOG_FILE 2>&1
    
    # Opción 4: Reiniciar backend
    log "🔄 Reiniciando backend..."
    docker restart sigc_app >> $LOG_FILE 2>&1
    
    log "✅ Sincronización completada"
}

# Ejecutar verificación y sincronización
check_backend
check_db

if check_schema_diff; then
    log "✅ Esquema sincronizado, no se requieren acciones"
else
    log "⚠️ Esquema desincronizado, ejecutando sincronización..."
    do_sync
    sleep 5
    # Verificar que la sincronización funcionó
    if check_schema_diff; then
        log "✅ Sincronización exitosa"
    else
        log "❌ Sincronización falló, revisar logs"
    fi
fi

rm -f $SYNC_LOCK
