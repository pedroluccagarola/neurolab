@echo off
chcp 850 >nul <nul
setlocal
title NEURO LAB - Limpar sessäes
rem ÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍ
rem  NEURO LAB - LIMPAR_SESSOES.bat
rem  Guarda uma c¢pia de data\sessions.json com data e hora no nome
rem  (data\sessions_backup_AAAA-MM-DD_HH-MM-SS.json) e deixa o arquivo
rem  como [] - painel e contagem come‡am do zero.
rem ÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍ

cd /d "%~dp0"
set "ARQ=data\sessions.json"

if exist "%ARQ%" goto :tem_arquivo
if not exist "data" mkdir "data"
> "%ARQ%" echo []
echo.
echo   NÆo havia data\sessions.json - criei o arquivo vazio [].
goto :fim

:tem_arquivo
set "TOTAL=?"
for /f "delims=" %%n in ('node -e "try{console.log(JSON.parse(require('fs').readFileSync('data/sessions.json','utf8').trim()||'[]').length)}catch(e){console.log('?')}" 2^>nul') do set "TOTAL=%%n"
echo.
echo   data\sessions.json tem %TOTAL% sessäes.
echo   Uma c¢pia de seguran‡a ser  criada antes de zerar o arquivo.
echo.
:pergunta
set "OP="
set /p "OP=  Limpar as sessäes? (S/N) "
if /i "%OP%"=="N" (
  echo.
  echo   Nada foi alterado.
  goto :fim
)
if /i not "%OP%"=="S" goto :pergunta

for /f "delims=" %%d in ('powershell -NoProfile -Command "Get-Date -Format yyyy-MM-dd_HH-mm-ss"') do set "AGORA=%%d"
if not defined AGORA set "AGORA=%RANDOM%"
set "BACKUP=data\sessions_backup_%AGORA%.json"

copy /y "%ARQ%" "%BACKUP%" >nul
if errorlevel 1 goto :falhou
fc /b "%ARQ%" "%BACKUP%" >nul
if errorlevel 1 goto :falhou

> "%ARQ%" echo []
if errorlevel 1 (
  echo.
  echo   ERRO: o backup foi feito, mas nÆo consegui zerar data\sessions.json.
  echo   Feche programas que estejam usando o arquivo e tente de novo.
  goto :fim
)
echo.
echo   OK - backup salvo em %BACKUP%
echo   OK - data\sessions.json agora est  vazio []
goto :fim

:falhou
echo.
echo   ERRO: nÆo consegui criar o backup em %BACKUP%.
echo   Nada foi apagado. Confira se o pen drive nÆo est  cheio ou protegido contra grava‡Æo.

:fim
echo.
echo   Pressione qualquer tecla para fechar.
pause >nul
exit /b
