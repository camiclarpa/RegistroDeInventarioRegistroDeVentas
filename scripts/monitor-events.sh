#!/bin/bash
echo "========================================="
echo "📊 MONITOREO DE EVENTOS - SIGC-MOTOS"
echo "========================================="

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Verificar Redis
echo -e "\n🔴 REDIS STATUS:"
REDIS_PING=$(docker exec sigc_redis redis-cli ping 2>/dev/null)
if [ "$REDIS_PING" = "PONG" ]; then
    echo -e "${GREEN}✅ Redis: Conectado${NC}"
else
    echo -e "${RED}❌ Redis: Desconectado${NC}"
fi

# Verificar stream de eventos
echo -e "\n📡 EVENT STREAM:"
STREAM_LEN=$(docker exec sigc_redis redis-cli xlen events 2>/dev/null)
echo "   Longitud del stream: $STREAM_LEN"

# Verificar grupos de consumidores
echo -e "\n👥 CONSUMER GROUPS:"
docker exec sigc_redis redis-cli xinfo groups events 2>/dev/null | grep -A 5 "name" | head -10

# Verificar Dead Letter Queue
echo -e "\n💀 DEAD LETTER QUEUE:"
DLQ_LEN=$(docker exec sigc_redis redis-cli llen dead-letter-queue 2>/dev/null)
if [ "$DLQ_LEN" -gt 0 ]; then
    echo -e "${YELLOW}⚠️ Mensajes en DLQ: $DLQ_LEN${NC}"
else
    echo -e "${GREEN}✅ DLQ vacía${NC}"
fi

# Verificar métricas de eventos
echo -e "\n📈 MÉTRICAS:"
for service in inventory notification report; do
    HEALTH=$(curl -s http://localhost:8888/health 2>/dev/null | jq -r '.status')
    echo "   $service-service: $HEALTH"
done

echo -e "\n========================================="
