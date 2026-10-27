@echo off
setlocal enabledelayedexpansion
title Instalador CohenScalperV1.0 - Trader Nation
echo.
echo  Instalador do robo CohenScalperV1.0 - Trader Nation
echo  ------------------------------------------------
echo.
set "ARQ=%~dp0CohenScalperV1.0.ex5"
if not exist "%ARQ%" (
  echo  Nao encontrei o CohenScalperV1.0.ex5 nesta pasta.
  echo  Descompacte o arquivo .zip inteiro antes de rodar o instalador.
  echo.
  pause
  exit /b 1
)
set /a N=0
for /d %%D in ("%APPDATA%\MetaQuotes\Terminal\*") do (
  if exist "%%D\MQL5\Experts\" (
    copy /Y "%ARQ%" "%%D\MQL5\Experts\" >nul
    if not errorlevel 1 (
      set /a N+=1
      set "ORIG=%%~nxD"
      if exist "%%D\origin.txt" for /f "usebackq delims=" %%L in (`type "%%D\origin.txt"`) do set "ORIG=%%L"
      echo  [OK] !ORIG!
    )
  )
)
echo.
if !N!==0 (
  echo  Nenhum MetaTrader 5 encontrado neste computador.
  echo  Instale o MetaTrader 5 da sua corretora, abra uma vez e rode este instalador de novo.
  echo.
  pause
  exit /b 1
)
echo  Pronto! Robo instalado em !N! MetaTrader 5.
echo.
echo  Proximos passos no MetaTrader 5:
echo   1. Navegador - Consultor Expert - botao direito - Atualizar
echo   2. Arraste o CohenScalperV1.0 para o grafico do mini indice WIN, tempo M5
echo   3. Aba Parametros: cole sua chave, se tiver, e informe os contratos
echo   4. Aba Comum: marque Permitir Algotrading - OK
echo   5. Ferramentas - Opcoes - Experts: marque Permitir WebRequest e adicione
echo      https://robos-cohen.vercel.app
echo   6. Botao Algotrading verde na barra de cima
echo.
pause
