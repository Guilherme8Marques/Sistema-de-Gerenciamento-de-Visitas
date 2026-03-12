@echo off
chcp 65001 >nul
:: Pedir permissão de Administrador
>nul 2>&1 "%SYSTEMROOT%\system32\cacls.exe" "%SYSTEMROOT%\system32\config\system"
if '%errorlevel%' NEQ '0' (
    echo Solicitando privilegios de Administrador para Remover o Servidor...
    goto UACPrompt
) else ( goto gotAdmin )
:UACPrompt
    echo Set UAC = CreateObject^("Shell.Application"^) > "%temp%\getadmin.vbs"
    echo UAC.ShellExecute "%~s0", "", "", "runas", 1 >> "%temp%\getadmin.vbs"
    "%temp%\getadmin.vbs"
    exit /B
:gotAdmin
    if exist "%temp%\getadmin.vbs" ( del "%temp%\getadmin.vbs" )
    pushd "%CD%"
    CD /D "%~dp0"

echo [AVISO] Parando e removendo o servico VisitasServer do Windows...
"%~dp0nssm\nssm.exe" stop VisitasServer
"%~dp0nssm\nssm.exe" remove VisitasServer confirm
echo.
echo Pronto! Servico deletado permanentemente. O servidor nao vai mais iniciar sosinho junto com o Windows.
pause
