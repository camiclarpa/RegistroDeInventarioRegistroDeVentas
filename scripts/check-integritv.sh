#!/bin/bash
# VERIFICACIÓN DE INTEGRIDAD PRISMA ↔ BD

cd /opt/SIGH_MOTOS

echo "========================================="
echo "🔍 VERIFICANDO INTEGRIDAD"
echo "========================================="

# Verificar campos en schema.prisma vs BD real
echo ""
echo "📌 1. Verificando modelo Product..."
docker exec sigc_db psql -U postgres -d sigc_motos -c "\d products" | grep -E "skuInternal|nameCommercial|stockQuantity" | wc -l
echo "campos esperados: 3"

echo ""
echo "📌 2. Verificando que Prisma puede conectar..."
docker exec sigc_app npx prisma validate 2>&1 | head -3

echo ""
echo "📌 3. Estado de sincronización..."
docker exec sigc_app npx prisma migrate status 2>&1 | head -5

echo ""
echo "========================================="
