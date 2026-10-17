@echo off
setlocal EnableExtensions DisableDelayedExpansion
set "REPO=poke2201/aozora-english-fan-patcher"
rem Place this BAT beside the game executable.
set "GAME_DIR=%~dp0"
if not exist "%GAME_DIR%resources" (
 echo ERROR: Missing Resources Folder!.
 echo Place this BAT in the game folder or check that the resources folder exists.
 pause
 exit /b 1
)
set "PKG=%TEMP%\AozoraPatcher-%RANDOM%-%RANDOM%"
mkdir "%PKG%" || goto :fail
set "URL=https://github.com/%REPO%/releases/latest/download/Aozora-Patcher-Windows.zip"
echo Downloading the latest patcher from GitHub...
curl.exe -fLsS --retry 3 "%URL%" -o "%PKG%\release.zip"
if errorlevel 1 goto :fail
powershell.exe -NoProfile -NonInteractive -Command "Expand-Archive -LiteralPath (Join-Path $env:PKG 'release.zip') -DestinationPath $env:PKG -Force" >nul
if errorlevel 1 goto :fail
if not exist "%PKG%\runtime\node.exe" goto :fail
if not exist "%PKG%\src\patcher.cjs" goto :fail
"%PKG%\runtime\node.exe" "%PKG%\src\patcher.cjs" install "%GAME_DIR%"
if errorlevel 1 goto :fail
set "RESULT=0"
goto :done
:fail
echo.
echo Installation did not complete. See error above.
set "RESULT=1"
:done
if defined PKG if exist "%PKG%" rmdir /S /Q "%PKG%" >nul 2>&1
pause
exit /b %RESULT%
