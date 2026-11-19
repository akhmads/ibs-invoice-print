@echo off
cd /d "%~dp0"
"%~dp0node.exe" src\server.js --check-db
pause
