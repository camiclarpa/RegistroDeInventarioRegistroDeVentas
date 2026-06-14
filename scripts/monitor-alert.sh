#!/bin/bash
# Script de monitoreo y alertas para SIGC-Motos

# Cargar variables de entorno
source /opt/SIGH_MOTOS/.env.production 2>/dev/null

BOT_TOKEN="${TELEGRAM_BOT_TOKEN:-}"
CHAT_ID="${TELEGRAM_CHAT_ID:-}"

# Función para enviar alerta a Telegram
send_telegram() {
    local message="$1"
    if [ -n "$BOT_TOKEN" ] && [ -n "$CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot$BOT_TOKEN/sendMessage" \
            -d "chat_id=$CHAT_ID" \
            -d "text=$message" \
            -d "parse_mode=HTML" > /dev/null 2>&1
    fi
}

# Verificar estado de contenedores
check_containers() {
    local down_containers=""
    for container in sigc_app sigc_db sigc_redis sigc_voice; do
        if ! docker ps --format "{{.Names}}" | grep -q "^$container$"; then
            down_containers="$down_containers $container"
        fi
    done
    
    if [ -n "$down_containers" ]; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0AContenedores detenidos:$down_containers%0A$(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
    return 0
}

# Verificar API health
check_api() {
    if ! curl -s -f http://localhost:3001/health > /dev/null 2>&1; then
        send_telegram "🚨 <b>SIGC-Motos ALERTA CRÍTICA</b>%0AAPI no responde en puerto 3001%0A$(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
    return 0
}

# Verificar frontend
check_frontend() {
    if ! curl -s -f http://localhost:8888/nginx-health > /dev/null 2>&1; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0AFrontend no responde en puerto 8888%0A$(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
    return 0
}

# Verificar disco
check_disk() {
    local usage=$(df -h / | awk 'NR==2 {print $5}' | sed 's/%//')
    if [ "$usage" -gt 85 ]; then
        send_telegram "💾 <b>SIGC-Motos Alerta</b>%0ADisco al ${usage}% de uso!%0ARevisar espacio disponible%0A$(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
    return 0
}

# Verificar memoria
check_memory() {
    local mem_used=$(free | grep Mem | awk '{print $3/$2 * 100.0}' | cut -d. -f1)
    if [ "$mem_used" -gt 90 ]; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0AMemoria al ${mem_used}% de uso%0A$(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
    return 0
}

# Verificar errores en logs recientes
check_errors() {
    local errors=$(docker logs sigc_app --tail 50 2>&1 | grep -c '"level":"error"' | head -1)
    if [ "$errors" -gt 5 ]; then
        send_telegram "⚠️ <b>SIGC-Motos Alerta</b>%0A$errors errores en logs del backend%0ARevisar con: docker logs sigc_app --tail 100%0A$(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
    return 0
}

# Verificar backup reciente
check_backup() {
    local latest_backup=$(ls -t /opt/SIGH_MOTOS/backups/*.sql.gz 2>/dev/null | head -1)
    if [ -z "$latest_backup" ]; then
        send_telegram "❌ <b>SIGC-Motos Alerta</b>%0ANo se encontraron backups recientes%0AEjecutar: ./scripts/backup/auto-backup.sh%0A$(date '+%Y-%m-%d %H:%M:%S')"
        return 1
    fi
    return 0
}

# Verificar productos bajos en stock
check_low_stock() {
    local low_stock=$(docker exec sigc_db psql -U postgres -d sigc_motos -t -c \
        "SELECT COUNT(*) FROM products WHERE stock_quantity <= min_stock_level AND is_active = true;" 2>/dev/null | tr -d ' ')
    
    if [ -n "$low_stock" ] && [ "$low_stock" -gt 0 ]; then
        send_telegram "📦 <b>SIGC-Motos Inventario</b>%0A$low_stock productos con stock bajo%0ARequieren reposición%0A$(date '+%Y-%m-%d %H:%M:%S')"
    fi
}

# Reporte diario (8 AM)
check_daily_report() {
    local hour=$(date +%H)
    if [ "$hour" = "08" ]; then
        local sales_today=$(docker exec sigc_db psql -U postgres -d sigc_motos -t -c \
            "SELECT COUNT(*) FROM sales WHERE DATE(created_at) = CURRENT_DATE;" 2>/dev/null | tr -d ' ')
        local products_count=$(docker exec sigc_db psql -U postgres -d sigc_motos -t -c \
            "SELECT COUNT(*) FROM products WHERE is_active = true;" 2>/dev/null | tr -d ' ')
        
        send_telegram "📊 <b>SIGC-Motos Reporte Diario</b>%0A📅 $(date '+%Y-%m-%d')%0A📦 Productos activos: ${products_count:-0}%0A💰 Ventas hoy: ${sales_today:-0}%0A🕒 Reporte generado automáticamente"
    fi
}

# Ejecutar verificaciones
check_containers
check_api
check_frontend
check_disk
check_memory
check_errors
check_backup
check_low_stock
check_daily_report
