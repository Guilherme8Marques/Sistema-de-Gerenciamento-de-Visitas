@echo off
chcp 65001 >nul

echo ============================================
echo   Parar Servico - Cotacao Pesquisa
echo ============================================
echo.

:: Verificar se esta executando como administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Este script precisa ser executado como Administrador!
    echo.
    pause
    exit /b 1
)

set "NSSM_EXE=%~dp0nssm\nssm.exe"
set "SERVICE_NAME=CotacaoPesquisaInsumos"

"%NSSM_EXE%" stop %SERVICE_NAME%

echo.
echo [INFO] Verificando status...
"%NSSM_EXE%" status %SERVICE_NAME%

echo.
pause
