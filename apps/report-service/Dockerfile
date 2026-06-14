FROM node:20-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas las dependencias
RUN npm ci

# Copiar Prisma schema y generar cliente
COPY prisma ./prisma/
RUN npx prisma generate

# Copiar código fuente
COPY src ./src

# Construir
RUN npm run build

# Limpiar devDependencies
RUN npm prune --production

EXPOSE 3005

CMD ["npm", "start"]
