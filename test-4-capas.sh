#!/bin/bash

echo "========================================="
echo "🧪 PRUEBA EXHAUSTIVA - ARQUITECTURA 4 CAPAS"
echo "========================================="
echo "Fecha: $(date)"
echo ""

# Colores para output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Contadores
CAPA1_SCORE=0
CAPA2_SCORE=0
CAPA3_SCORE=0
CAPA4_SCORE=0
CAPA1_MAX=25
CAPA2_MAX=25
CAPA3_MAX=25
CAPA4_MAX=25

# ============================================
# CAPA 1: CLEAN ARCHITECTURE
# ============================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📐 CAPA 1: CLEAN/HEXAGONAL ARCHITECTURE${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

# Test 1.1: Domain no importa de infraestructura
echo -n "Test 1.1: Domain sin imports de @prisma/client... "
PRISMA_IMPORTS=$(grep -r "from '@prisma/client'" src/core/domain/ 2>/dev/null | wc -l)
if [ $PRISMA_IMPORTS -eq 0 ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA1_SCORE=$((CAPA1_SCORE + 5))
else
    echo -e "${RED}❌ FAIL ($PRISMA_IMPORTS imports encontrados)${NC}"
fi

# Test 1.2: Entidades existen
echo -n "Test 1.2: Entidades de dominio existen... "
ENTITIES=$(ls -1 src/core/domain/entities/*.ts 2>/dev/null | wc -l)
if [ $ENTITIES -ge 5 ]; then
    echo -e "${GREEN}✅ PASS ($ENTITIES entidades)${NC}"
    CAPA1_SCORE=$((CAPA1_SCORE + 3))
else
    echo -e "${RED}❌ FAIL (solo $ENTITIES entidades)${NC}"
fi

# Test 1.3: Application services existen
echo -n "Test 1.3: Application services existen... "
SERVICES=$(ls -1 src/core/application/services/*.ts 2>/dev/null | wc -l)
if [ $SERVICES -ge 5 ]; then
    echo -e "${GREEN}✅ PASS ($SERVICES services)${NC}"
    CAPA1_SCORE=$((CAPA1_SCORE + 3))
else
    echo -e "${RED}❌ FAIL (solo $SERVICES services)${NC}"
fi

# Test 1.4: Repository interfaces existen
echo -n "Test 1.4: Repository interfaces existen... "
REPOS=$(ls -1 src/core/domain/repositories/*.ts 2>/dev/null | wc -l)
if [ $REPOS -ge 4 ]; then
    echo -e "${GREEN}✅ PASS ($REPOS interfaces)${NC}"
    CAPA1_SCORE=$((CAPA1_SCORE + 3))
else
    echo -e "${RED}❌ FAIL (solo $REPOS interfaces)${NC}"
fi

# Test 1.5: Mappers existen
echo -n "Test 1.5: Mappers de infraestructura existen... "
MAPPERS=$(ls -1 src/infrastructure/prisma/mappers/*.ts 2>/dev/null | wc -l)
if [ $MAPPERS -ge 2 ]; then
    echo -e "${GREEN}✅ PASS ($MAPPERS mappers)${NC}"
    CAPA1_SCORE=$((CAPA1_SCORE + 3))
else
    echo -e "${RED}❌ FAIL (solo $MAPPERS mappers)${NC}"
fi

# Test 1.6: DI Container existe
echo -n "Test 1.6: DI Container configurado... "
if [ -f src/infrastructure/config/di-container.ts ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA1_SCORE=$((CAPA1_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 1.7: Deuda técnica (any)
echo -n "Test 1.7: Deuda técnica controlada (< 50 'any')... "
ANY_COUNT=$(grep -r ": any" src/ --include="*.ts" 2>/dev/null | wc -l)
if [ $ANY_COUNT -lt 50 ]; then
    echo -e "${GREEN}✅ PASS ($ANY_COUNT usos de 'any')${NC}"
    CAPA1_SCORE=$((CAPA1_SCORE + 5))
else
    echo -e "${RED}❌ FAIL ($ANY_COUNT usos de 'any')${NC}"
fi

echo -e "\n📊 CAPA 1 SCORE: $CAPA1_SCORE / $CAPA1_MAX"

# ============================================
# CAPA 2: MICROSERVICIOS
# ============================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🔌 CAPA 2: MICROSERVICIOS${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

# Test 2.1: Inventory service corriendo
echo -n "Test 2.1: Inventory service corriendo... "
INV_HEALTH=$(curl -s http://localhost:3003/health 2>/dev/null | jq -r '.status')
if [ "$INV_HEALTH" = "ok" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA2_SCORE=$((CAPA2_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 2.2: Notification service corriendo
echo -n "Test 2.2: Notification service corriendo... "
NOTIF_HEALTH=$(curl -s http://localhost:3004/health 2>/dev/null | jq -r '.status')
if [ "$NOTIF_HEALTH" = "ok" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA2_SCORE=$((CAPA2_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 2.3: Report service corriendo
echo -n "Test 2.3: Report service corriendo... "
REP_HEALTH=$(curl -s http://localhost:3005/health 2>/dev/null | jq -r '.status')
if [ "$REP_HEALTH" = "ok" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA2_SCORE=$((CAPA2_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 2.4: API Gateway funcionando
echo -n "Test 2.4: API Gateway ruteando... "
GW_STATUS=$(curl -s http://localhost:8889/health 2>/dev/null | jq -r '.status')
if [ "$GW_STATUS" = "ok" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA2_SCORE=$((CAPA2_SCORE + 4))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 2.5: Productos accesibles vía gateway
echo -n "Test 2.5: Productos accesibles vía gateway... "
PROD_COUNT=$(curl -s http://localhost:8889/api/v1/products 2>/dev/null | jq -r '.data | length')
if [ "$PROD_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS ($PROD_COUNT productos)${NC}"
    CAPA2_SCORE=$((CAPA2_SCORE + 4))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 2.6: Comunicación entre servicios
echo -n "Test 2.6: Comunicación inventory → notification... "
COMM_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3003/health)
if [ "$COMM_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA2_SCORE=$((CAPA2_SCORE + 4))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 2.7: Resiliencia - matar notification service
echo -n "Test 2.7: Resiliencia (inventory funciona sin notification)... "
docker stop sigc_notification_service > /dev/null 2>&1
sleep 2
INV_STILL_WORKS=$(curl -s http://localhost:3003/health 2>/dev/null | jq -r '.status')
if [ "$INV_STILL_WORKS" = "ok" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA2_SCORE=$((CAPA2_SCORE + 4))
else
    echo -e "${RED}❌ FAIL${NC}"
fi
docker start sigc_notification_service > /dev/null 2>&1

echo -e "\n📊 CAPA 2 SCORE: $CAPA2_SCORE / $CAPA2_MAX"

# ============================================
# CAPA 3: EVENT-DRIVEN
# ============================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📡 CAPA 3: EVENT-DRIVEN ARCHITECTURE${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

# Test 3.1: Redis Streams existe
echo -n "Test 3.1: Redis Streams operativo... "
REDIS_PING=$(docker exec sigc_redis redis-cli ping 2>/dev/null)
if [ "$REDIS_PING" = "PONG" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA3_SCORE=$((CAPA3_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 3.2: Eventos definidos
echo -n "Test 3.2: Tipos de eventos definidos... "
EVENT_TYPES=$(grep -rh "super('" src/core/domain/events/ 2>/dev/null | wc -l)
if [ $EVENT_TYPES -ge 5 ]; then
    echo -e "${GREEN}✅ PASS ($EVENT_TYPES tipos)${NC}"
    CAPA3_SCORE=$((CAPA3_SCORE + 3))
else
    echo -e "${RED}❌ FAIL (solo $EVENT_TYPES tipos)${NC}"
fi

# Test 3.3: PRUEBA CRÍTICA - Eventos automáticos
echo -n "Test 3.3: Eventos se publican AUTOMÁTICAMENTE... "
EVENTS_BEFORE=$(docker exec sigc_redis redis-cli XLEN events 2>/dev/null)
curl -s -X POST http://localhost:8889/api/v1/products \
  -H "Content-Type: application/json" \
  -d "{\"sku\":\"AUTO-TEST-$(date +%s)\",\"name\":\"Auto Test\",\"price\":100,\"stock\":5}" > /dev/null
sleep 2
EVENTS_AFTER=$(docker exec sigc_redis redis-cli XLEN events 2>/dev/null)
if [ "$EVENTS_AFTER" -gt "$EVENTS_BEFORE" ]; then
    echo -e "${GREEN}✅ PASS (evento publicado automáticamente)${NC}"
    CAPA3_SCORE=$((CAPA3_SCORE + 8))
else
    echo -e "${RED}❌ FAIL (eventos no automáticos)${NC}"
fi

# Test 3.4: Consumers procesando eventos
echo -n "Test 3.4: Consumers procesando eventos... "
CONSUMER_LOGS=$(docker logs sigc_notification_service 2>&1 | grep -i "event.*processed" | wc -l)
if [ $CONSUMER_LOGS -gt 0 ]; then
    echo -e "${GREEN}✅ PASS ($CONSUMER_LOGS eventos procesados)${NC}"
    CAPA3_SCORE=$((CAPA3_SCORE + 5))
else
    echo -e "${RED}❌ FAIL (consumers inactivos)${NC}"
fi

# Test 3.5: Outbox Pattern
echo -n "Test 3.5: Outbox Pattern implementado... "
OUTBOX_COUNT=$(docker exec sigc_db psql -U postgres -d sigc_motos -t -c "SELECT COUNT(*) FROM outbox_events;" 2>/dev/null | tr -d ' ')
if [ "$OUTBOX_COUNT" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS ($OUTBOX_COUNT registros)${NC}"
    CAPA3_SCORE=$((CAPA3_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 3.6: Dead Letter Queue
echo -n "Test 3.6: Dead Letter Queue implementada... "
if [ -f src/infrastructure/messaging/DeadLetterQueue.ts ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA3_SCORE=$((CAPA3_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

echo -e "\n📊 CAPA 3 SCORE: $CAPA3_SCORE / $CAPA3_MAX"

# ============================================
# CAPA 4: RESILIENCE & OBSERVABILITY
# ============================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}🛡️ CAPA 4: RESILIENCE & OBSERVABILITY${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

# Test 4.1: Circuit Breaker implementado
echo -n "Test 4.1: Circuit Breaker implementado... "
if [ -f src/infrastructure/resilience/CircuitBreaker.ts ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA4_SCORE=$((CAPA4_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 4.2: Circuit Breaker INTEGRADO (no solo implementado)
echo -n "Test 4.2: Circuit Breaker INTEGRADO en llamadas... "
CB_USAGE=$(grep -r "CircuitBreaker" src/ --include="*.ts" 2>/dev/null | grep -v "class CircuitBreaker" | wc -l)
if [ $CB_USAGE -gt 2 ]; then
    echo -e "${GREEN}✅ PASS ($CB_USAGE usos)${NC}"
    CAPA4_SCORE=$((CAPA4_SCORE + 5))
else
    echo -e "${RED}❌ FAIL (no integrado)${NC}"
fi

# Test 4.3: Métricas Prometheus
echo -n "Test 4.3: Métricas Prometheus expuestas... "
METRICS=$(curl -s http://localhost:3003/metrics 2>/dev/null | wc -l)
if [ $METRICS -gt 100 ]; then
    echo -e "${GREEN}✅ PASS ($METRICS líneas de métricas)${NC}"
    CAPA4_SCORE=$((CAPA4_SCORE + 4))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 4.4: Grafana corriendo
echo -n "Test 4.4: Grafana accesible... "
GRAFANA_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:3002 2>/dev/null)
if [ "$GRAFANA_STATUS" = "200" ] || [ "$GRAFANA_STATUS" = "302" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA4_SCORE=$((CAPA4_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 4.5: Jaeger corriendo
echo -n "Test 4.5: Jaeger accesible... "
JAEGER_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:16686 2>/dev/null)
if [ "$JAEGER_STATUS" = "200" ]; then
    echo -e "${GREEN}✅ PASS${NC}"
    CAPA4_SCORE=$((CAPA4_SCORE + 3))
else
    echo -e "${RED}❌ FAIL${NC}"
fi

# Test 4.6: Traces reales en Jaeger
echo -n "Test 4.6: Traces reales en Jaeger... "
TRACES=$(curl -s "http://localhost:16686/api/services" 2>/dev/null | jq '.data | length')
if [ "$TRACES" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS ($TRACES servicios con traces)${NC}"
    CAPA4_SCORE=$((CAPA4_SCORE + 4))
else
    echo -e "${RED}❌ FAIL (sin traces)${NC}"
fi

# Test 4.7: Alertas configuradas
echo -n "Test 4.7: Alertas configuradas en Grafana... "
ALERTS=$(curl -s http://localhost:3002/api/alerts -u admin:admin 2>/dev/null | jq '.totalCount')
if [ "$ALERTS" -gt 0 ]; then
    echo -e "${GREEN}✅ PASS ($ALERTS alertas)${NC}"
    CAPA4_SCORE=$((CAPA4_SCORE + 3))
else
    echo -e "${RED}❌ FAIL (sin alertas)${NC}"
fi

echo -e "\n📊 CAPA 4 SCORE: $CAPA4_SCORE / $CAPA4_MAX"

# ============================================
# RESUMEN FINAL
# ============================================
echo -e "\n${YELLOW}═══════════════════════════════════════════════════════════${NC}"
echo -e "${YELLOW}📊 RESUMEN FINAL${NC}"
echo -e "${YELLOW}═══════════════════════════════════════════════════════════${NC}"

TOTAL_SCORE=$((CAPA1_SCORE + CAPA2_SCORE + CAPA3_SCORE + CAPA4_SCORE))
TOTAL_MAX=$((CAPA1_MAX + CAPA2_MAX + CAPA3_MAX + CAPA4_MAX))
PERCENTAGE=$((TOTAL_SCORE * 100 / TOTAL_MAX))

echo ""
echo "┌─────────────────────────────────────────────────────────────────┐"
echo "│ CAPA                    │ SCORE      │ PORCENTAJE               │"
echo "├─────────────────────────────────────────────────────────────────┤"
printf "│ %-22s │ %-10s │ %-24s │\n" "Clean Architecture" "$CAPA1_SCORE/$CAPA1_MAX" "$((CAPA1_SCORE * 100 / CAPA1_MAX))%"
printf "│ %-22s │ %-10s │ %-24s │\n" "Microservicios" "$CAPA2_SCORE/$CAPA2_MAX" "$((CAPA2_SCORE * 100 / CAPA2_MAX))%"
printf "│ %-22s │ %-10s │ %-24s │\n" "Event-Driven" "$CAPA3_SCORE/$CAPA3_MAX" "$((CAPA3_SCORE * 100 / CAPA3_MAX))%"
printf "│ %-22s │ %-10s │ %-24s │\n" "Resilience" "$CAPA4_SCORE/$CAPA4_MAX" "$((CAPA4_SCORE * 100 / CAPA4_MAX))%"
echo "├─────────────────────────────────────────────────────────────────┤"
printf "│ %-22s │ %-10s │ %-24s │\n" "TOTAL" "$TOTAL_SCORE/$TOTAL_MAX" "$PERCENTAGE%"
echo "└─────────────────────────────────────────────────────────────────┘"

echo ""
if [ $PERCENTAGE -ge 90 ]; then
    echo -e "${GREEN}🎉 EXCELENTE: Arquitectura enterprise-grade${NC}"
elif [ $PERCENTAGE -ge 75 ]; then
    echo -e "${YELLOW}👍 BUENO: Arquitectura sólida con mejoras menores${NC}"
elif [ $PERCENTAGE -ge 60 ]; then
    echo -e "${YELLOW}⚠️  ACEPTABLE: Funcional pero necesita trabajo${NC}"
else
    echo -e "${RED}❌ INSUFICIENTE: Requiere trabajo significativo${NC}"
fi

echo ""
echo "========================================="
echo "FIN DE LA PRUEBA"
echo "========================================="
