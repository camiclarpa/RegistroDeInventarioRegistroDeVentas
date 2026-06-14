#!/bin/bash
# VALIDACIÓN PRE-EJECUCIÓN

VALIDATION_PASSED=true

# Colores
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# 1. Verificar que no se ejecuta como root en comandos peligrosos
if [ "$EUID" -eq 0 ]; then
    if [[ "$*" == *"rm -rf"* ]] || [[ "$*" == *"rm -fr"* ]]; then
        echo -e "${RED}🚨 BLOQUEADO: No se puede ejecutar 'rm -rf' como root${NC}"
        VALIDATION_PASSED=false
    fi
fi

# 2. Verificar que no se eliminan volúmenes sin backup
if [[ "$*" == *"docker volume rm"* ]] && [[ "$*" != *"--force"* ]]; then
    if [ ! -f "/opt/SIGH_MOTOS/backups/latest_backup.sql.gz" ]; then
        echo -e "${RED}🚨 BLOQUEADO: Eliminar volúmenes requiere backup reciente${NC}"
        VALIDATION_PASSED=false
    fi
fi

# 3. Verificar que no se ejecuta `docker compose down -v`
if [[ "$*" == *"docker compose down -v"* ]] || [[ "$*" == *"docker-compose down -v"* ]]; then
    echo -e "${RED}🚨 BLOQUEADO: 'docker compose down -v' elimina volúmenes permanentemente${NC}"
    VALIDATION_PASSED=false
fi

# 4. Verificar que no se ejecuta `prisma migrate reset`
if [[ "$*" == *"prisma migrate reset"* ]]; then
    echo -e "${RED}🚨 BLOQUEADO: 'prisma migrate reset' borra todas las tablas${NC}"
    VALIDATION_PASSED=false
fi

# 5. Verificar que no se ejecuta `prisma db push` sin backup
if [[ "$*" == *"prisma db push"* ]] && [[ "$*" != *"--accept-data-loss"* ]]; then
    if [ ! -f "/opt/SIGH_MOTOS/backups/latest_backup.sql.gz" ]; then
        echo -e "${YELLOW}⚠️ ADVERTENCIA: No hay backup reciente. Ejecutando de todas formas...${NC}"
    fi
fi

if [ "$VALIDATION_PASSED" = true ]; then
    echo -e "${GREEN}✅ Validación pasada. Ejecutando: $*${NC}"
    eval "$*"
else
    echo -e "${RED}❌ Comando bloqueado por razones de seguridad${NC}"
    exit 1
fi
