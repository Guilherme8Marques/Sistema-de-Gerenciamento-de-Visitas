#!/bin/bash

# Script de Backup - Sistema de Gerenciamento de Visitas
# Este script faz uma cópia do banco SQLite e comprime para economizar espaço.

# Configurações
DB_PATH="/home/ubuntu/Ferramenta_de_visitas/server/database.db"
BACKUP_DIR="/home/ubuntu/backups"
TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
BACKUP_NAME="database_backup_$TIMESTAMP.bak"

# Criar diretório de backup se não existir
mkdir -p "$BACKUP_DIR"

echo "Iniciando backup do banco de dados..."

# Usar o comando sqlite3 .backup para garantir integridade (evita cópia de arquivo em uso parcial)
if command -v sqlite3 &> /dev/null
then
    sqlite3 "$DB_PATH" ".backup '$BACKUP_DIR/$BACKUP_NAME'"
else
    # Fallback se o sqlite3-tool não estiver instalado (cópia simples)
    cp "$DB_PATH" "$BACKUP_DIR/$BACKUP_NAME"
fi

# Comprimir o backup
gzip "$BACKUP_DIR/$BACKUP_NAME"

# Limpeza: Manter apenas os últimos 7 dias de backup para não encher o disco
find "$BACKUP_DIR" -name "*.bak.gz" -mtime +7 -delete

echo "Backup concluído com sucesso em: $BACKUP_DIR/${BACKUP_NAME}.gz"

# Dica: Para enviar para o S3 automaticamente no futuro:
# aws s3 cp "$BACKUP_DIR/${BACKUP_NAME}.gz" s3://seu-bucket-de-backups/
