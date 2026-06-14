#!/bin/bash
# ============================================
# RECUPERACIÓN DE EMERGENCIA
# ============================================

cd /opt/SIGH_MOTOS

echo "🚨 RECUPERACIÓN DE EMERGENCIA"
echo "========================================="

# 1. Verificar backups disponibles
echo "📁 Backups disponibles:"
ls -la backups/sync/*.sql.gz 2>/dev/null | tail -5

# 2. Preguntar qué backup restaurar
echo ""
read -p "Ingrese el nombre del backup a restaurar (o 'latest'): " BACKUP_NAME

if [ "$BACKUP_NAME" = "latest" ]; then
    BACKUP_FILE=$(ls -t backups/sync/*.sql.gz | head -1)
else
    BACKUP_FILE="backups/sync/$BACKUP_NAME"
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo "❌ Backup no encontrado"
    exit 1
fi

echo "✅ Restaurando: $BACKUP_FILE"

# 3. Restaurar backup
gunzip -c "$BACKUP_FILE" | docker exec -i sigc_db psql -U postgres -d sigc_motos

# 4. Sincronizar Prisma
docker exec -e DATABASE_URL="postgresql://postgres:postgres123@sigc_db:5432/sigc_motos?schema=public" \
    sigc_app npx prisma db pull --force

docker exec sigc_app npx prisma generate
docker exec sigc_app npm run build
docker restart sigc_app

echo "✅ RECUPERACIÓN COMPLETADA"
