#!/bin/bash
echo "Parando o servidor para evitar colisões no banco de dados..."
docker compose stop app

echo "Executando script de limpeza do banco..."
docker compose run --rm app npx tsx scripts/limpar-banco.ts

echo "Iniciando o servidor novamente..."
docker compose start app

echo "Limpeza concluída."
