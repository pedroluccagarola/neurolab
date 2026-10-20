@echo off
chcp 850 >nul <nul
setlocal
title NEURO LAB - Iniciar feira
rem ÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍ
rem  NEURO LAB - INICIAR_FEIRA.bat
rem  Liga tudo para a feira: Quest (adb), t£nel opcional para o QR,
rem  servidor e as telas no Chrome. Usa s¢ caminhos relativos a esta
rem  pasta (%~dp0), entÆo funciona do pen drive em qualquer PC.
rem  Ferramentas em tools\ (adb e cloudflared) - nada para instalar
rem  al‚m do Node.js.
rem ÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍ

cd /d "%~dp0"
set "RAIZ=%~dp0"
set "PORTA=3000"
set "CLOUDFLARED=%RAIZ%tools\cloudflared.exe"
rem adb da pasta tools na frente do PATH: ‚ sempre ele que roda
set "PATH=%RAIZ%tools\platform-tools;%PATH%"

rem Cores (sequˆncias ANSI do console do Windows 10/11)
for /f %%e in ('echo prompt $E^| cmd') do set "ESC=%%e"
set "VERDE=%ESC%[92m"
set "AMARELO=%ESC%[93m"
set "VERMELHO=%ESC%[91m"
set "CIANO=%ESC%[96m"
set "NORMAL=%ESC%[0m"

echo.
echo %CIANO%  ÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍ
echo     NEURO LAB - preparando a feira
echo   ÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍ%NORMAL%
echo.

rem ÄÄ 1. NODE.JS ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ
echo [1/5] Verificando o Node.js...
where node >nul 2>nul
if errorlevel 1 (
  call :erro "Node.js nÆo est  instalado neste computador." "Instale a versÆo LTS em nodejs.org, feche esta janela e rode o INICIAR_FEIRA.bat de novo."
  goto :fim
)
for /f "delims=" %%v in ('node -v') do set "NODE_VER=%%v"
for /f "tokens=1 delims=v." %%m in ("%NODE_VER%") do set "NODE_MAJOR=%%m"
if %NODE_MAJOR% LSS 18 (
  call :erro "Node.js %NODE_VER% ‚ antigo demais - o NEURO LAB precisa da versÆo 18 ou mais nova." "Instale a versÆo LTS em nodejs.org e rode este arquivo de novo."
  goto :fim
)
echo       %VERDE%OK%NORMAL% Node %NODE_VER%

if exist "node_modules\express\package.json" goto :deps_ok
echo       Pasta node_modules ausente - instalando dependˆncias (precisa de internet)...
call npm install
if errorlevel 1 (
  call :erro "NÆo foi poss¡vel instalar as dependˆncias (npm install)." "Conecte na internet e rode este arquivo de novo, ou copie a pasta node_modules junto com o projeto."
  goto :fim
)
:deps_ok

rem Porta livre? Se j  responde, h  um servidor aberto em outra janela.
curl.exe -s -o nul --max-time 2 http://localhost:%PORTA%/ >nul 2>nul
if not errorlevel 1 (
  call :erro "A porta %PORTA% j  est  em uso - provavelmente o servidor j  est  aberto em outra janela." "Feche a janela 'NEURO LAB - SERVIDOR' (ou aperte Ctrl+C nela) e rode este arquivo de novo."
  goto :fim
)

rem ÄÄ 2. QUEST (ADB) ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ
:quest
echo.
echo [2/5] Procurando o Quest no cabo USB...
if not exist "%RAIZ%tools\platform-tools\adb.exe" (
  call :erro "adb.exe nÆo encontrado em tools\platform-tools." "Copie a pasta platform-tools para dentro de tools\ e rode de novo."
  goto :fim
)
adb start-server >nul 2>nul
set "QUEST="
rem Pode haver outro aparelho (celular com DroidCam): pega s¢ o modelo "Quest"
for /f "tokens=1,2" %%a in ('adb devices -l ^| findstr /i /c:"model:Quest"') do if "%%b"=="device" set "QUEST=%%a"
if defined QUEST goto :quest_achou

set "NAO_AUTORIZADO="
adb devices | findstr /c:"unauthorized" >nul && set "NAO_AUTORIZADO=1"
if defined NAO_AUTORIZADO (
  call :erro "H  um aparelho no USB esperando autoriza‡Æo." "Coloque o Quest na cabe‡a e toque em PERMITIR na mensagem de depura‡Æo USB - marque 'sempre permitir deste computador'."
) else (
  call :erro "Quest nÆo encontrado no USB." "Confira se o Quest est  ligado e o cabo USB-C conectado no PC. Troque de porta ou de cabo se precisar."
)
echo       Aparelhos que o adb est  vendo:
adb devices -l
:quest_pergunta
set "OP="
set /p "OP=      [T] tentar de novo    [C] continuar sem o Quest  : "
if /i "%OP%"=="T" goto :quest
if /i "%OP%"=="C" goto :tunel
goto :quest_pergunta

:quest_achou
echo       %VERDE%OK%NORMAL% Quest encontrado: %QUEST%
adb -s "%QUEST%" reverse tcp:%PORTA% tcp:%PORTA% >nul
if errorlevel 1 (
  call :erro "O comando adb reverse falhou - o Quest nÆo vai alcan‡ar o servidor." "Desconecte e reconecte o cabo do Quest e escolha T."
  goto :quest_pergunta
)
echo       %VERDE%OK%NORMAL% adb reverse tcp:%PORTA% - o Quest abre localhost:%PORTA%
adb -s "%QUEST%" shell am broadcast -a com.oculus.vrpowermanager.prox_close >nul
if errorlevel 1 (
  echo       %AMARELO%AVISO%NORMAL% NÆo consegui desligar o sensor de proximidade - a tela do Quest pode apagar quando ningu‚m estiver usando.
) else (
  echo       %VERDE%OK%NORMAL% Sensor de proximidade desligado - a tela nÆo apaga entre visitantes
)

rem ÄÄ 3. TéNEL ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ
:tunel
echo.
echo [3/5] Endere‡o do QR code
echo       S = t£nel: o celular do visitante abre o relat¢rio com qualquer internet, inclusive dados m¢veis
echo       N = rede local: o celular precisa estar na mesma rede Wi-Fi deste PC - escola ou hotspot
:tunel_pergunta
set "USAR_TUNEL="
set /p "USAR_TUNEL=      Usar t£nel para o QR? (S/N) "
if /i "%USAR_TUNEL%"=="S" goto :com_tunel
if /i "%USAR_TUNEL%"=="N" goto :sem_tunel
goto :tunel_pergunta

:com_tunel
if not exist "%CLOUDFLARED%" (
  call :erro "cloudflared.exe nÆo encontrado em tools\." "Sem ele nÆo h  t£nel. Responda N para usar a rede local."
  goto :tunel_pergunta
)
set "TUNEL_LOG=%TEMP%\neurolab_tunel_%RANDOM%%RANDOM%.log"
echo       Abrindo o t£nel - leva alguns segundos...
start "NEURO LAB - TUNEL (nao feche)" /min "%CLOUDFLARED%" tunnel --no-autoupdate --protocol http2 --logfile "%TUNEL_LOG%" --url http://localhost:%PORTA%
set "TUNEL_URL="
set /a ESPERA=0
:espera_tunel
set /a ESPERA+=1
ping -n 2 127.0.0.1 >nul
call :ler_url_tunel
if defined TUNEL_URL goto :tunel_ok
if %ESPERA% LSS 45 goto :espera_tunel
taskkill /fi "WINDOWTITLE eq NEURO LAB - TUNEL*" >nul 2>nul
call :erro "O t£nel nÆo gerou um endere‡o em 45 segundos." "Este PC est  sem internet ou a rede da escola bloqueia a Cloudflare. Responda N para usar a rede local, ou S para tentar de novo."
goto :tunel_pergunta

:tunel_ok
echo       %VERDE%OK%NORMAL% T£nel criado: %TUNEL_URL%
set "PUBLIC_URL=%TUNEL_URL%"
goto :servidor

:sem_tunel
rem Rede local: o servidor detecta sozinho o IP do Wi-Fi. Limpa um
rem PUBLIC_URL herdado do sistema; um PUBLIC_URL do .env continua valendo.
set "PUBLIC_URL="
set "TUNEL_URL="

rem ÄÄ 4. SERVIDOR ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ
:servidor
echo.
echo [4/5] Iniciando o servidor...
start "NEURO LAB - SERVIDOR (nao feche)" cmd /k node server.js
set /a ESPERA=0
:espera_servidor
set /a ESPERA+=1
ping -n 2 127.0.0.1 >nul
curl.exe -s -o nul --max-time 2 http://localhost:%PORTA%/ping >nul 2>nul && goto :servidor_ok
if %ESPERA% LSS 30 goto :espera_servidor
call :erro "O servidor nÆo respondeu em 30 segundos." "Veja a mensagem de erro na janela 'NEURO LAB - SERVIDOR'. Depois feche as janelas do NEURO LAB e rode este arquivo de novo."
goto :fim

:servidor_ok
set "QR_URL="
for /f "usebackq delims=" %%q in (`powershell -NoProfile -Command "(Invoke-RestMethod http://localhost:%PORTA%/ping).qr"`) do set "QR_URL=%%q"
echo       %VERDE%OK%NORMAL% Servidor rodando na porta %PORTA%

rem Confere se o t£nel j  entrega no servidor - por fora ele responde 403 de prop¢sito
if not defined TUNEL_URL goto :navegador
set "TUNEL_STATUS="
set /a ESPERA=0
:espera_tunel_publico
set /a ESPERA+=1
for /f %%c in ('curl.exe -s -o nul -w "%%{http_code}" --max-time 10 %TUNEL_URL%/ping 2^>nul') do set "TUNEL_STATUS=%%c"
if "%TUNEL_STATUS%"=="403" goto :tunel_publico_ok
ping -n 3 127.0.0.1 >nul
if %ESPERA% LSS 10 goto :espera_tunel_publico
echo       %AMARELO%AVISO%NORMAL% O t£nel ainda nÆo respondeu pela internet. Teste o QR com um celular nos dados m¢veis antes de abrir ao p£blico.
goto :navegador
:tunel_publico_ok
echo       %VERDE%OK%NORMAL% T£nel respondendo pela internet - por ele s¢ abre o relat¢rio

rem ÄÄ 5. NAVEGADOR ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ
:navegador
echo.
echo [5/5] Abrindo as telas no Chrome...
set "CHROME="
if not defined CHROME if exist "%ProgramFiles%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe" set "CHROME=%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
if not defined CHROME if exist "%LocalAppData%\Google\Chrome\Application\chrome.exe" set "CHROME=%LocalAppData%\Google\Chrome\Application\chrome.exe"
if not defined CHROME goto :sem_chrome
start "" "%CHROME%" --new-window "http://localhost:%PORTA%"
start "" "%CHROME%" --new-window "http://localhost:%PORTA%/painel/coletivo.html"
echo       %VERDE%OK%NORMAL% HUD e painel abertos
goto :resumo
:sem_chrome
echo       %AMARELO%AVISO%NORMAL% Chrome nÆo encontrado - abrindo no navegador padrÆo.
start "" "http://localhost:%PORTA%"
start "" "http://localhost:%PORTA%/painel/coletivo.html"

rem ÄÄ RESUMO ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ
:resumo
echo.
echo %AMARELO%  ÉÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍ»
echo   º                                                            º
echo   º   ENDERE€O DO QR CODE:                                     º
echo   º                                                            º
echo   ÈÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍÍ¼%NORMAL%
echo.
echo       %AMARELO%%QR_URL%%NORMAL%
echo.
if defined TUNEL_URL (
  echo       T£nel: o visitante abre o relat¢rio com qualquer internet - dados m¢veis ou Wi-Fi.
) else (
  echo       Rede local: o celular do visitante precisa estar na MESMA rede Wi-Fi deste PC.
)
echo %QR_URL% | findstr /i "localhost" >nul && echo       %VERMELHO%ATEN€ÇO: o QR est  em localhost - o celular nÆo vai abrir. Conecte o PC no Wi-Fi ou hotspot. O servidor pega o IP novo sozinho.%NORMAL%
echo.
echo   HUD do scan:     http://localhost:%PORTA%
echo   Painel:          http://localhost:%PORTA%/painel/coletivo.html
if defined QUEST (
  echo   Quest:           abrir localhost:%PORTA%/vr/lab.html no Meta Browser
) else (
  echo   %AMARELO%Quest:           NÇO CONECTADO - ligue o cabo e siga o Plano B do guia - Quest desconectou.%NORMAL%
)
echo.
if defined TUNEL_URL (
  echo   NÆo feche as janelas "NEURO LAB - SERVIDOR" e "NEURO LAB - TUNEL". Para encerrar a feira: feche as duas.
) else (
  echo   NÆo feche a janela "NEURO LAB - SERVIDOR". Para encerrar a feira: feche essa janela.
)

:fim
echo.
echo   Pressione qualquer tecla para fechar esta janela.
pause >nul
exit /b

rem ÄÄ SUB-ROTINAS ÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄÄ
:erro
echo.
echo %VERMELHO%  X ERRO: %~1%NORMAL%
if not "%~2"=="" echo     %~2
echo.
goto :eof

:ler_url_tunel
rem O cloudflared grava a URL no log, ex.: "|  https://xxx-yyy.trycloudflare.com  |"
set "TUNEL_URL="
if not exist "%TUNEL_LOG%" goto :eof
findstr /c:"https://" "%TUNEL_LOG%" | findstr /c:".trycloudflare.com" | findstr /v /c:"api.trycloudflare.com" >nul || goto :eof
for /f "usebackq delims=" %%u in (`powershell -NoProfile -Command "Select-String -LiteralPath $env:TUNEL_LOG -Pattern 'https://[a-z0-9-]+\.trycloudflare\.com' | ForEach-Object { $_.Matches[0].Value } | Where-Object { $_ -notmatch '//api\.' } | Select-Object -First 1"`) do set "TUNEL_URL=%%u"
goto :eof
