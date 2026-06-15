#!/bin/bash
echo "========================================="
echo "🏢 INICIANDO PLATAFORMA EMPRESARIAL"
echo "========================================="

cd /opt/SIGH_MOTOS

# 1. Limpiar gateway antiguos
echo "1. Limpiando gateways antiguos..."
docker rm -f sigc_nginx sigc_gateway sigc_gw 2>/dev/null

# 2. Asegurar que Traefik está configurado
echo "2. Configurando Traefik..."
if ! grep -q "traefik:" docker-compose.yml; then
    cat >> docker-compose.yml << 'EOF'

  traefik:
    image: traefik:v3.0
    container_name: sigc_traefik
    restart: unless-stopped
    command:
      - "--api.insecure=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--providers.docker.network=sigc-net"
      - "--entrypoints.web.address=:80"
    ports:
      - "80:80"
      - "8080:8080"
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
    networks:
      - sigc-net
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=PathPrefix(`/dashboard`)"
      - "traefik.http.routers.dashboard.service=api@internal"
