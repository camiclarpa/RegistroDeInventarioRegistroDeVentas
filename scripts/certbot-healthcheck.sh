#!/bin/bash
# Healthcheck para Certbot
while true; do
    if ! docker ps --filter "name=sigc_certbot" --filter "status=running" | grep -q sigc_certbot; then
        echo "[$(date)] ⚠️ Certbot no está corriendo, reiniciando..."
        docker start sigc_certbot 2>/dev/null || docker run -d --name sigc_certbot \
            --restart unless-stopped \
            --network sigh_motos_default \
            -v certbot_certs:/etc/letsencrypt \
            -v certbot_www:/var/www/certbot \
            certbot/certbot:latest \
            sleep infinity
    fi
    sleep 30
done
