@echo off
cd /d "%~dp0"
node scripts/build.mjs
if errorlevel 1 goto failed
start "" "http://localhost:5188"
node server.mjs
goto end
:failed
echo HERMES could not start. Make sure Node.js is installed.
pause
:end
