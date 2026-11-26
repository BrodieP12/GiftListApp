@echo off
setlocal
cd /d "%~dp0"

if "%~1"=="" (
    where node >nul 2>nul
    if %ERRORLEVEL% equ 0 (
        node "%~dp0scripts\dev-menu.mjs"
        goto :end
    )
)

powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0scripts\dev-devices.ps1" %*
if %ERRORLEVEL% neq 0 (
    echo.
    echo Script failed with exit code %ERRORLEVEL%.
    pause
)

:end
endlocal
