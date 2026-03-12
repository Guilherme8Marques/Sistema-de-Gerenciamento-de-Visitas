@echo off
chcp 65001 >nul

echo ============================================
echo   Reinicio Seguro - Ferramenta de Visitas
echo ============================================
echo.

:: Verificar se esta executando como administrador
net session >nul 2>&1
if %errorlevel% neq 0 (
    echo [ERRO] Este script precisa ser executado como Administrador!
    echo.
    echo Clique com o botao direito no arquivo e selecione
    echo "Executar como administrador"
    echo.
    pause
    exit /b 1
)

:: Mudar para o diretorio do projeto
cd /d "%~dp0.."

set "NSSM_EXE=%~dp0nssm\nssm.exe"
set "SERVICE_NAME=VisitasServer"

:: PASSO 1: Parar apenas o servico NSSM (graceful shutdown)
echo [1/4] Parando o servico...
"%NSSM_EXE%" stop %SERVICE_NAME%

:: PASSO 2: Aguardar liberacao de recursos (banco e arquivos)
echo [2/4] Aguardando liberacao de recursos...
timeout /t 3 >nul

:: PASSO 3: Build do frontend (sem tocar no banco)
echo [3/4] Recompilando o painel visual...
call npm run build
if %errorlevel% neq 0 (
    echo.
    echo [ERRO] Falha ao executar "npm run build".
    echo O servidor NAO sera religado para proteger o banco de dados.
    echo Corrija o erro do build e tente novamente.
    echo.
    pause
    exit /b 1
)
echo.

:: PASSO 4: Ligar novamente o servico
echo [4/4] Ligando o servidor atualizado...
"%NSSM_EXE%" start %SERVICE_NAME%

echo.
echo ============================================
echo   [OK] Reinicio completo!
echo ============================================
echo.
echo Banco de dados e lock mantidos com seguranca.
echo Consulte o arquivo "server\db_audit.log" em caso de duvida.
echo.
pause
