@echo off
setlocal EnableExtensions DisableDelayedExpansion
rem Place this file beside the game executable, above the resources folder.
set "GAME_DIR=%~dp0"
if not exist "%GAME_DIR%resources" (
 echo ERROR: Missing resources folder. Place this BAT beside the game's executable.
 pause
 exit /b 1
)
if not exist "%GAME_DIR%resources\app.asar" (
 echo ERROR: Missing resources\app.asar.
 pause
 exit /b 1
)
set "PKG=%TEMP%\AozoraPatcher-%RANDOM%-%RANDOM%"
set "NODE_URL=https://nodejs.org/dist/v24.13.1/win-x64/node.exe"
set "NODE_SHA256=e3be0545990c90995d7bf3a7af5d64af1f2e0fc1bbd9b79c27f7abc1e9676e50"
rem The smaller patcher payload is built by tools\Build_Payload.ps1 and committed to downloads/.
set "PAYLOAD_URL=https://raw.githubusercontent.com/poke2201/aozora-english-fan-patcher/main/downloads/Aozora-Patcher-Payload.zip"
mkdir "%PKG%" || goto :fail
if errorlevel 1 goto :fail

echo Downloading pinned portable Node.js 24.13.1...
curl.exe -fLsS --retry 3 --connect-timeout 20 "%NODE_URL%" -o "%PKG%\node.exe"
if errorlevel 1 goto :fail

rem Verify the pinned runtime against the official Node.js release checksum.
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "if ((Get-FileHash -LiteralPath (Join-Path $env:PKG 'node.exe') -Algorithm SHA256).Hash -ine $env:NODE_SHA256) { exit 1 }"
if errorlevel 1 (
 echo ERROR: Node.js checksum verification failed. Aborting.
 goto :fail
)

echo Downloading the patcher and translations...
curl.exe -fLsS --retry 3 --connect-timeout 20 "%PAYLOAD_URL%" -o "%PKG%\payload.zip"
if errorlevel 1 goto :fail
powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath (Join-Path $env:PKG 'payload.zip') -DestinationPath $env:PKG -Force"
if errorlevel 1 goto :fail
if not exist "%PKG%\src\patcher.cjs" goto :fail
if not exist "%PKG%\src\build_aozora_patch_v2.cjs" goto :fail
if not exist "%PKG%\manifests\aozora_patch_manifest.json" goto :fail
if not exist "%PKG%\node_modules\@electron\asar\package.json" goto :fail

echo Running Aozora patcher (restore)...
"%PKG%\node.exe" "%PKG%\src\patcher.cjs" restore "%GAME_DIR%"
if errorlevel 1 goto :fail
set "RESULT=0"
goto :done
:fail
echo.
echo ERROR: restore did not complete. Check the messages above.
set "RESULT=1"
:done
if defined PKG if exist "%PKG%" rmdir /S /Q "%PKG%" >nul 2>&1
pause
exit /b %RESULT%
