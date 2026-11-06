@echo off
setlocal

set EMULATOR=%LOCALAPPDATA%\Android\Sdk\emulator\emulator.exe
set AVD=Medium_Phone_API_36.1

echo Starting emulator 1 (read-only): %AVD%
start "" "%EMULATOR%" -avd %AVD% -read-only

echo Waiting 5 seconds before starting second emulator...
timeout /t 5 /nobreak >nul

echo Starting emulator 2 (read-only): %AVD%
start "" "%EMULATOR%" -avd %AVD% -read-only

echo Both emulators launched. Waiting 30 seconds for them to boot...
timeout /t 30 /nobreak >nul

echo Starting Expo dev server...
cd /d "%~dp0"
start "Expo Dev Server" cmd /k "npx expo start"

echo Done! Use the Expo dev server window to install on each emulator.
