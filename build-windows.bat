@echo off
setlocal
cd /d %~dp0
call npm ci
if errorlevel 1 goto failed
call npm run package:installer
if errorlevel 1 goto failed
echo.
echo Build complete: see release-v140-installer\
pause
exit /b 0
:failed
echo Build failed. Check the error above.
pause
exit /b 1
