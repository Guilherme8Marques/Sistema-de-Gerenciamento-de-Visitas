# Use a imagem base estável do Node (Alpine para leveza)
FROM node:20-alpine

# Instalar dependências necessárias para módulos nativos (ex: better-sqlite3)
RUN apk add --no-cache python3 make g++ 

WORKDIR /app

# Copiar apenas os arquivos de dependências primeiro (otimização de cache)
COPY package*.json ./

# Instalar apenas as dependências de produção
RUN npm install --omit=dev

# Copiar os artefatos pré-compilados pelo GitHub Actions e a pasta do servidor
COPY dist ./dist
COPY server ./server

# Criar o diretório de dados para o SQLite
RUN mkdir -p dados

# Expor a porta definida na aplicação
EXPOSE 5000

ENV NODE_ENV=production
ENV PORT=5000

# Executar o servidor usando tsx (conforme configurado no projeto)
CMD ["npx", "tsx", "server/index.ts"]
