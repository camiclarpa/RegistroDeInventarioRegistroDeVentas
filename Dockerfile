# Stage 1: Build
FROM node:20-slim AS builder

WORKDIR /app

# Instalar dependencias de sistema
RUN apt-get update && apt-get install -y openssl ca-certificates python3 make g++ && rm -rf /var/lib/apt/lists/*

# Copiar archivos de configuración
COPY package*.json ./
COPY tsconfig.json ./
COPY prisma.config.ts ./

# Instalar dependencias
RUN npm ci --ignore-scripts

# Copiar TODO el código fuente (ESTO DEBE FUNCIONAR)
COPY src/ ./src/
COPY prisma/ ./prisma/

# Generar cliente Prisma
RUN npx prisma generate

# Compilar TypeScript
RUN npx tsc

# Stage 2: Production
FROM node:20-alpine AS production

WORKDIR /app

RUN apk add --no-cache openssl
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

# Copiar desde builder
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts

RUN chown -R nextjs:nodejs /app

USER nextjs

EXPOSE 3000

CMD ["node", "dist/server.js"]
