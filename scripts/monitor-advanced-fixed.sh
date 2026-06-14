#!/bin/bash
# ============================================
# SIGC-Motos - Monitoreo Avanzado (CORREGIDO)
# ============================================

LOG_FILE="/var/log/sigc-monitor.log"
ALERT_LOG="/var/log/sigc-alerts.log"
METRICS_FILE="/tmp/sigc_metrics.json"

# Cargar variables
source /opt/SIGH_MOTOS/.env.production 2>/dev/null

# Función para ejecutar consultas SQL
run_sql() {
    docker exec sigc_db psql -U postgres -d sigc_motos -t -c "$1" 2>/dev/null | tr -d ' '
}

# Función para enviar alerta a Telegram
send_telegram() {
    local message="$1"
    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/sendMessage" \
            -d "chat_id=$TELEGRAM_CHAT_ID" \
            -d "text=$message" \
            -d "parse_mode=HTML" > /dev/null 2>&1
        echo "[$(date '+%Y-%m-%d %H:%M:%S')] ALERTA: $message" >> $ALERT_LOG
    fi
}

# 1. Monitoreo de recursos del sistema
check_system_resources() {
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1 | tr -d ' ' | head -1)
    CPU_USAGE=${CPU_USAGE:-0}
    
    MEM_TOTAL=$(free | grep Mem | awk '{print $2}')
    MEM_USED=$(free | grep Mem | awk '{print $3}')
    MEM_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))
    
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ -n "$CPU_USAGE" ] && [ "$CPU_USAGE" != "0" ] && (( $(echo "$CPU_USAGE > 80" | bc -l 2>/dev/null || echo "0") )); then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0A🔥 CPU al ${CPU_USAGE}% (>80%)%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    if [ "$MEM_PERCENT" -gt 90 ]; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0A💾 Memoria al ${MEM_PERCENT}% (>90%)%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
    
    if [ "$DISK_USAGE" -gt 85 ]; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0A💿 Disco al ${DISK_USAGE}% (>85%)%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# 2. Monitoreo de contenedores
check_containers_health() {
    local containers="sigc_app sigc_db sigc_redis sigc_voice sigc_nginx"
    local down=""
    
    for c in $containers; do
        if ! docker ps --format "{{.Names}}" | grep -q "^$c$"; then
            down="$down $c"
        fi
    done
    
    if [ -n "$down" ]; then
        send_telegram "🚨 <b>SIGC-Motos Alerta CRÍTICA</b>%0AContenedores detenidos:$down%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# 3. Monitoreo de API
check_api_endpoints() {
    if ! curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        send_telegram "🚨 <b>SIGC-Motos ALERTA CRÍTICA</b>%0A❌ API no responde%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# 4. Monitoreo de base de datos
check_database() {
    if ! docker exec sigc_db pg_isready -U postgres > /dev/null 2>&1; then
        send_telegram "🚨 <b>SIGC-Motos ALERTA CRÍTICA</b>%0A🗄️ Base de datos no responde%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# 5. Monitoreo de errores en logs
check_error_logs() {
    ERROR_COUNT=$(docker logs sigc_app --since 5m 2>&1 | grep -c '"level":"error"' || echo "0")
    if [ -n "$CPU_USAGE" ] && [ "$CPU_USAGE" != "0" ] && [ "$CPU_USAGE" != "0.0" ] && (( $(echo "$CPU_USAGE > 80" | bc -l 2>/dev/null || echo "0") )); then
    if [ -n "$ERROR_COUNT" ] && [ "$ERROR_COUNT" -gt 10 ]; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0A📝 $ERROR_COUNT errores en 5 min%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# 6. Monitoreo de backups
check_backup_status() {
    LATEST_BACKUP=$(ls -t /opt/SIGH_MOTOS/backups/daily/*.sql.gz 2>/dev/null | head -1)
    
    if [ -z "$LATEST_BACKUP" ]; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0A📁 No hay backups recientes%0A$(date '+%Y-%m-%d %H:%M:%S')"
        return
    fi
    
    BACKUP_AGE=$(($(date +%s) - $(stat -c %Y "$LATEST_BACKUP")))
    if [ "$BACKUP_AGE" -gt 86400 ]; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0A📁 Backup desactualizado ($((BACKUP_AGE/3600)) horas)%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# 7. Monitoreo de inventario
check_inventory() {
    LOW_STOCK=$(run_sql "SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock_level AND is_active = true;")
    
    if [ -n "$LOW_STOCK" ] && [ "$LOW_STOCK" -gt 10 ]; then
        send_telegram "📦 <b>SIGC-Motos Inventario</b>%0A⚠️ $LOW_STOCK productos con stock bajo%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# 8. Generar métricas
generate_metrics() {
    PRODUCTOS=$(run_sql "SELECT COUNT(*) FROM products WHERE is_active = true;")
    VENTAS_HOY=$(run_sql "SELECT COUNT(*) FROM sales WHERE DATE(created_at) = CURRENT_DATE;")
    INGRESOS_HOY=$(run_sql "SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE DATE(created_at) = CURRENT_DATE;")
    
    cat > $METRICS_FILE << JSON
{
    "timestamp": "$(date -Iseconds)",
    "productos": ${PRODUCTOS:-0},
    "ventas_hoy": ${VENTAS_HOY:-0},
    "ingresos_hoy": ${INGRESOS_HOY:-0},
    "cpu_usage": ${CPU_USAGE:-0},
    "mem_usage": ${MEM_PERCENT:-0},
    "disk_usage": ${DISK_USAGE:-0}
}
JSON
}

# 9. Reporte diario
daily_report() {
    local hour=$(date +%H)
    if [ "$hour" = "08" ]; then
        PRODUCTOS=$(run_sql "SELECT COUNT(*) FROM products;")
        VENTAS=$(run_sql "SELECT COUNT(*) FROM sales WHERE created_at >= NOW() - INTERVAL '1 day';")
        INGRESOS=$(run_sql "SELECT COALESCE(SUM(total_amount),0) FROM sales WHERE created_at >= NOW() - INTERVAL '1 day';")
        STOCK_BAJO=$(run_sql "SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock_level AND is_active = true;")
        
        MESSAGE="📊 <b>SIGC-Motos Reporte Diario</b>%0A📅 $(date '+%Y-%m-%d')%0A%0A📦 Productos: ${PRODUCTOS:-0}%0A💰 Ventas (24h): ${VENTAS:-0} ($${INGRESOS:-0})%0A⚠️ Stock bajo: ${STOCK_BAJO:-0}"
        send_telegram "$MESSAGE"
    fi
}

# Ejecutar verificaciones
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === MONITOREO AVANZADO ===" | tee -a $LOG_FILE

check_system_resources
check_containers_health
check_api_endpoints
check_database
check_error_logs
check_backup_status
check_inventory
generate_metrics
daily_report

echo "[$(date '+%Y-%m-%d %H:%M:%S')] === MONITOREO COMPLETADO ===" | tee -a $LOG_FILE
