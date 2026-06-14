#!/bin/bash
# ============================================
# SIGC-Motos - Monitoreo Limpio
# ============================================

LOG_FILE="/var/log/sigc-monitor.log"
ALERT_LOG="/var/log/sigc-alerts.log"
METRICS_FILE="/tmp/sigc_metrics.json"

source /opt/SIGH_MOTOS/.env.production 2>/dev/null

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

run_sql() {
    docker exec sigc_db psql -U postgres -d sigc_motos -t -c "$1" 2>/dev/null | tr -d ' '
}

# Monitoreo de recursos
check_resources() {
    CPU_USAGE=$(top -bn1 | grep "Cpu(s)" | awk '{print $2}' | cut -d'%' -f1)
    CPU_USAGE=${CPU_USAGE:-0}
    
    MEM_TOTAL=$(free | grep Mem | awk '{print $2}')
    MEM_USED=$(free | grep Mem | awk '{print $3}')
    MEM_PERCENT=$((MEM_USED * 100 / MEM_TOTAL))
    
    DISK_USAGE=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    
    if [ -n "$CPU_USAGE" ] && [ "$CPU_USAGE" != "0" ] && [ "$CPU_USAGE" != "0.0" ]; then
        if [ "$(echo "$CPU_USAGE > 80" | bc -l 2>/dev/null)" = "1" ]; then
            send_telegram "⚠️ CPU al ${CPU_USAGE}%"
        fi
    fi
    
    if [ "$MEM_PERCENT" -gt 90 ]; then
        send_telegram "⚠️ Memoria al ${MEM_PERCENT}%"
    fi
    
    if [ "$DISK_USAGE" -gt 85 ]; then
        send_telegram "⚠️ Disco al ${DISK_USAGE}%"
    fi
}

# Monitoreo de contenedores
check_containers() {
    local down=""
    for c in sigc_app sigc_db sigc_redis sigc_voice sigc_nginx; do
        if ! docker ps --format "{{.Names}}" | grep -q "^$c$"; then
            down="$down $c"
        fi
    done
    if [ -n "$down" ]; then
        send_telegram "🚨 Contenedores detenidos:$down"
    fi
}

# Monitoreo de API
check_api() {
    if ! curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        send_telegram "🚨 API no responde"
    fi
}

# Generar métricas
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

# Ejecutar
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === MONITOREO ===" | tee -a $LOG_FILE
check_resources
check_containers
check_api
generate_metrics
echo "[$(date '+%Y-%m-%d %H:%M:%S')] === COMPLETADO ===" | tee -a $LOG_FILE
