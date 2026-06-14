#!/bin/bash
# ============================================
# SIGC-Motos - Backup Automático
# ============================================

BACKUP_DIR="/opt/SIGH_MOTOS/backups/daily"
LOG_FILE="/opt/SIGH_MOTOS/backups/logs/backup.log"
RETENTION_DAYS=7
WEEKLY_RETENTION=30
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/sigc_motos_$DATE.sql.gz"

# Función para log
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

log "=== INICIANDO BACKUP ==="

# 1. Verificar que PostgreSQL está corriendo
if ! docker ps | grep -q sigc_db; then
    log "❌ ERROR: Contenedor sigc_db no está corriendo"
    exit 1
fi

# 2. Crear backup
log "📦 Creando backup de sigc_motos..."
docker exec sigc_db pg_dump -U postgres sigc_motos | gzip > $BACKUP_FILE

# 3. Verificar que el backup no está vacío
if [ -s $BACKUP_FILE ]; then
    SIZE=$(du -h $BACKUP_FILE | cut -f1)
    log "✅ Backup creado: $BACKUP_FILE ($SIZE)"
else
    log "❌ ERROR: Backup vacío o falló"
    rm -f $BACKUP_FILE
    exit 1
fi

# 4. Backup semanal (los domingos)
if [ $(date +%u) -eq 7 ]; then
    WEEKLY_DIR="/opt/SIGH_MOTOS/backups/weekly"
    mkdir -p $WEEKLY_DIR
    cp $BACKUP_FILE $WEEKLY_DIR/sigc_motos_weekly_$DATE.sql.gz
    log "📆 Backup semanal creado"
    
    # Limpiar backups semanales viejos (más de 30 días)
    find $WEEKLY_DIR -name "sigc_motos_weekly_*.sql.gz" -mtime +$WEEKLY_RETENTION -delete
fi

# 5. Backup mensual (día 1 de cada mes)
if [ $(date +%d) -eq 1 ]; then
    MONTHLY_DIR="/opt/SIGH_MOTOS/backups/monthly"
    mkdir -p $MONTHLY_DIR
    cp $BACKUP_FILE $MONTHLY_DIR/sigc_motos_monthly_$DATE.sql.gz
    log "📅 Backup mensual creado"
fi

# 6. Limpiar backups diarios viejos
DELETED=$(find $BACKUP_DIR -name "sigc_motos_*.sql.gz" -mtime +$RETENTION_DAYS -delete -print | wc -l)
log "🗑️ Limpiados $DELETED backups antiguos (más de $RETENTION_DAYS días)"

# 7. Enviar alerta de éxito (opcional)
if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
    MESSAGE="✅ <b>SIGC-Motos Backup</b>%0A📁 Archivo: $(basename $BACKUP_FILE)%0A📦 Tamaño: $SIZE%0A📅 Fecha: $(date '+%Y-%m-%d %H:%M:%S')"
    curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
        -d "chat_id=$TELEGRAM_CHAT_ID" \
        -d "text=$MESSAGE" \
        -d "parse_mode=HTML" > /dev/null 2>&1
fi

log "=== BACKUP COMPLETADO EXITOSAMENTE ==="
