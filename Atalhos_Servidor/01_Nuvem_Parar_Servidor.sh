#!/bin/bash
echo "Parando o container do servidor (App)..."
docker compose stop app
echo "Servidor Parado. (Auto-save desativado)."
