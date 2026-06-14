FROM node:20-alpine

WORKDIR /app

# Copiar archivos de dependencias
COPY package*.json ./
COPY tsconfig.json ./

# Instalar todas las dependencias (incluyendo devDependencies para build)
RUN npm ci

# Copiar código fuente
COPY src ./src

# Construir
RUN npm run build

# Limpiar devDependencies después del build
RUN npm prune --production

EXPOSE 3004

CMD ["npm", "start"]
