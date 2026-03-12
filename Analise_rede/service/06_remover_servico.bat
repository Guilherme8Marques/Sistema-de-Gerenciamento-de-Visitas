@echo off
chcp 65001 >nul

echo ============================================
echo   Remover Servico - Cotacao Pesquisa
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

echo [AVISO] Isso ira remover completamente o servico do Windows.
echo O servico nao sera mais iniciado automaticamente.
echo.
set /p CONFIRM="Tem certeza? (S/N): "

if /i "%CONFIRM%" neq "S" (
    echo Operacao cancelada.
    pause
    exit /b 0
)

echo.
echo [INFO] Parando servico...
"%NSSM_EXE%" stop %SERVICE_NAME% >nul 2>&1

echo [INFO] Removendo servico...
"%NSSM_EXE%" remove %SERVICE_NAME% confirm

echo.
echo [OK] Servico removido com sucesso!
echo.
pause
