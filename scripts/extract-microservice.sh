#!/bin/bash
# Script para extraer un microservicio

SERVICE_NAME=$1
SERVICE_PORT=$2
SERVICE_DESCRIPTION=$3

if [ -z "$SERVICE_NAME" ] || [ -z "$SERVICE_PORT" ]; then
    echo "Uso: $0 <nombre> <puerto> [descripción]"
    echo "Ejemplo: $0 inventory 3002 'Gestión de inventario'"
    exit 1
fi

echo "🚀 Extrayendo $SERVICE_NAME-service..."

# Crear directorio
mkdir -p apps/$SERVICE_NAME-service/src/{controllers,services,repositories,domain,middleware,config}

# Crear package.json
cat > apps/$SERVICE_NAME-service/package.json << EOF
{
  "name": "@sigc/$SERVICE_NAME-service",
  "version": "1.0.0",
  "description": "${SERVICE_DESCRIPTION:-Servicio de $SERVICE_NAME}",
  "main": "dist/index.js",
  "scripts": {
    "dev": "ts-node-dev --respawn src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "clean": "rm -rf dist"
  },
  "dependencies": {
    "express": "^5.2.1",
    "@prisma/client": "^5.22.0",
    "cors": "^2.8.5",
    "helmet": "^7.1.0",
    "dotenv": "^16.3.1"
  },
  "devDependencies": {
    "@types/express": "^5.0.0",
    "@types/node": "^20.0.0",
    "ts-node-dev": "^2.0.0",
    "typescript": "^5.3.0"
  }
}
