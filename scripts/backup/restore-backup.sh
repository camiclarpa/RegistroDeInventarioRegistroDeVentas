#!/bin/bash
# ============================================
# SIGC-Motos - Restauración de Backup
# ============================================

BACKUP_FILE="$1"
LOG_FILE="/opt/SIGH_MOTOS/backups/logs/restore.log"

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

log() {
    echo -e "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a $LOG_FILE
}

# Verificar argumento
if [ -z "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Uso: $0 <archivo_backup.sql.gz>${NC}"
    echo "   Ejemplo: $0 backups/daily/sigc_motos_20260101_120000.sql.gz"
    exit 1
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}❌ Archivo no encontrado: $BACKUP_FILE${NC}"
    exit 1
fi

log "${YELLOW}=== INICIANDO RESTAURACIÓN ===${NC}"
log "📁 Backup: $BACKUP_FILE"

# 1. Verificar que el contenedor está corriendo
if ! docker ps | grep -q sigc_db; then
    log "${RED}❌ ERROR: Contenedor sigc_db no está corriendo${NC}"
    exit 1
fi

# 2. Hacer backup de seguridad antes de restaurar
SAFETY_BACKUP="/opt/SIGH_MOTOS/backups/safety_before_restore_$(date +%Y%m%d_%H%M%S).sql.gz"
log "🛡️ Creando backup de seguridad: $SAFETY_BACKUP"
docker exec sigc_db pg_dump -U postgres sigc_motos | gzip > $SAFETY_BACKUP

# 3. Restaurar el backup
log "🔄 Restaurando backup..."
gunzip -c $BACKUP_FILE | docker exec -i sigc_db psql -U postgres -d sigc_motos 2>&1 | tee -a $LOG_FILE

if [ ${PIPESTATUS[1]} -eq 0 ]; then
    log "${GREEN}✅ Restauración completada exitosamente${NC}"
    
    # 4. Verificar datos
    PRODUCTOS=$(docker exec sigc_db psql -U postgres -d sigc_motos -t -c "SELECT COUNT(*) FROM products;" 2>/dev/null | tr -d ' ')
    VENTAS=$(docker exec sigc_db psql -U postgres -d sigc_motos -t -c "SELECT COUNT(*) FROM sales;" 2>/dev/null | tr -d ' ')
    
    log "${GREEN}📊 Verificación post-restauración:${NC}"
    log "   Productos: $PRODUCTOS"
    log "   Ventas: $VENTAS"
    
    # 5. Enviar alerta de éxito
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        MESSAGE="✅ <b>SIGC-Motos Restauración</b>%0A📁 Backup: $(basename $BACKUP_FILE)%0A📦 Productos: $PRODUCTOS%0A💰 Ventas: $VENTAS%0A📅 $(date '+%Y-%m-%d %H:%M:%S')"
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=$MESSAGE" \
            -d "parse_mode=HTML" > /dev/null 2>&1
    fi
else
    log "${RED}❌ ERROR durante la restauración${NC}"
    log "⚠️ Backup de seguridad disponible: $SAFETY_BACKUP"
    exit 1
fi

log "${GREEN}=== RESTAURACIÓN COMPLETADA ===${NC}"
