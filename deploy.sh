#!/bin/bash
# ============================================
# SIGC-Motos - DESPLIEGUE AUTOMÁTICO
# ============================================

echo "========================================="
echo "🚀 DESPLEGANDO SIGC-MOTOS COMPLETO"
echo "========================================="

cd /opt/SIGH_MOTOS

# 1. Verificar/crear volúmenes externos
echo "📌 1. Verificando volúmenes..."
for vol in sigh_motos_pgdata sigh_motos_redis_data sigh_motos_uploads; do
    if ! docker volume inspect $vol > /dev/null 2>&1; then
        echo "   Creando volumen: $vol"
        docker volume create $vol
    fi
done

# 2. Crear volúmenes de configuración
echo "📌 2. Creando volúmenes de configuración..."
docker volume create nginx_html 2>/dev/null
docker volume create nginx_conf 2>/dev/null
docker volume create certbot_certs 2>/dev/null
docker volume create certbot_www 2>/dev/null

# 3. Copiar frontend al volumen (sin usar /opt)
echo "📌 3. Configurando frontend..."
if [ -d "frontend/dist" ]; then
    docker run --rm -v nginx_html:/target -v $(pwd)/frontend/dist:/source alpine sh -c "cp -r /source/* /target/ 2>/dev/null || true"
    echo "   ✅ Frontend copiado"
else
    echo "   ⚠️ frontend/dist no existe"
fi

# 4. Configurar nginx
echo "📌 4. Configurando nginx..."
mkdir -p nginx/conf.d
cat > nginx/conf.d/default.conf << 'NGINX'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;
    location / {
        try_files $uri $uri/ /index.html;
    }
    location /api/ {
        proxy_pass http://sigc_app:3000/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }
    location /voice/ {
        proxy_pass http://sigc_voice:8000/;
        proxy_set_header Host $host;
    }
}
NGINX

docker run --rm -v nginx_conf:/target -v $(pwd)/nginx/conf.d:/source alpine cp -r /source/* /target/ 2>/dev/null
echo "   ✅ Nginx configurado"

# 5. Levantar todos los servicios
echo "📌 5. Levantando servicios..."
docker compose up -d

# 6. Verificar estado
echo "📌 6. Verificando estado..."
sleep 15

echo ""
echo "========================================="
echo "✅ DESPLIEGUE COMPLETADO"
echo "========================================="
echo ""
echo "📊 ESTADO DE SERVICIOS:"
docker ps --format "table {{.Names}}\t{{.Status}}"
echo ""
echo "🌐 ACCESO:"
echo "   Frontend: http://localhost:8888"
echo "   Backend API: http://localhost:3001/health"
echo "   Voice Agent: http://localhost:8001/health"
echo ""
echo "🔐 Para probar login:"
echo "   curl -X POST http://localhost:3001/api/v1/auth/login \\"
echo "     -H 'Content-Type: application/json' \\"
echo "     -d '{\"email\":\"admin@motos.quantacloud.co\",\"password\":\"Admin123!\"}'"
