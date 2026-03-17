# Estágio de Build (CSS/Frontend)
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Instalar dependências para compilação se necessário
RUN apk add --no-cache python3 make g++ 

COPY package*.json ./
RUN npm install
COPY . .
RUN npm run build

# Estágio de Produção
FROM node:20-alpine
WORKDIR /app

# Instalar runtime para node-gyp se houver libs binárias
RUN apk add --no-cache python3

COPY package*.json ./
RUN npm install --omit=dev

# Copiar arquivos necessários
COPY --from=frontend-builder /app/dist ./dist
COPY --from=frontend-builder /app/server ./server
COPY --from=frontend-builder /app/dados ./dados

EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Rodar servidor
CMD ["npx", "tsx", "server/index.ts"]
