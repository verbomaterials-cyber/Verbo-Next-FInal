@echo off
setlocal
cd /d "%~dp0"
set "VERBO_NODE=node"
if exist ".local\node-path.txt" set /p VERBO_NODE=<".local\node-path.txt"
"%VERBO_NODE%" scripts\dev-local.mjs --open
if errorlevel 1 pause
