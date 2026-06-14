FROM nginx:1.27-alpine

# Configuración embebida (no requiere montar archivos)
RUN echo 'server { \
    listen 80; \
    server_name localhost; \
    \
    location /health { \
        add_header Content-Type application/json; \
        return 200 '"'"'{"status":"ok","gateway":"nginx","service":"sigc-gateway"}'"'"'; \
    } \
    \
    location /api/v1/products { \
        proxy_pass http://sigc_inventory_service:3003/api/v1/products; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    \
    location /api/v1/brands { \
        proxy_pass http://sigc_inventory_service:3003/api/v1/brands; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    \
    location /api/v1/categories { \
        proxy_pass http://sigc_inventory_service:3003/api/v1/categories; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    \
    location /api/v1/notifications { \
        proxy_pass http://sigc_notification_service:3004/api/v1/notifications; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    \
    location /api/v1/reports { \
        proxy_pass http://sigc_report_service:3005/api/v1/reports; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
    } \
    \
    location / { \
        proxy_pass http://sigc_app:3000; \
        proxy_set_header Host $host; \
        proxy_set_header X-Real-IP $remote_addr; \
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for; \
    } \
}' > /etc/nginx/conf.d/default.conf

EXPOSE 80
