@echo off
chcp 65001 >nul

echo ============================================
echo   Limpeza Profunda de Servidor Travado
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

echo [INFO] Parando o servico do Windows (se estiver rodando)...
"%~dp0nssm\nssm.exe" stop CotacaoPesquisaInsumos >nul 2>&1

echo [INFO] Matando todos os processos "fantasmas" do Python...
taskkill /F /IM python.exe /T

echo [INFO] Aguardando 3 segundos para limpar a memoria...
timeout /t 3 >nul

echo [INFO] Ligando o servidor com o codigo ATUALIZADO...
"%~dp0nssm\nssm.exe" start CotacaoPesquisaInsumos

echo.
echo [OK] Servidor completamente reiniciado!
echo Por favor, atualize sua pagina no navegador.
echo.
pause
