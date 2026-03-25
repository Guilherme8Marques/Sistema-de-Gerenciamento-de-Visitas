# Use a imagem base estável do Node (Debian Slim para melhor compatibilidade com better-sqlite3)
FROM node:20-slim

# Instalar dependências necessárias para módulos nativos
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Instalar tsx globalmente para garantir disponibilidade em produção
RUN npm install -g tsx

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

# Executar o servidor usando tsx (instalado globalmente)
CMD ["tsx", "server/index.ts"]
