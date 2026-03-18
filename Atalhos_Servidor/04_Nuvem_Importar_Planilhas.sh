#!/bin/bash
echo "Parando o app para evitar que o autosave sobrescreva a importação..."
docker compose stop app

echo "Iniciando importação de dados..."
docker compose run --rm app npx tsx server/import-dados.ts

echo "Iniciando o servidor novamente..."
docker compose start app

echo "Dados importados com sucesso. O sistema já está online."
