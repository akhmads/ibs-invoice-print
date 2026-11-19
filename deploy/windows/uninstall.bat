@echo off
setlocal
cd /d "%~dp0"
title Uninstall Invoice Print

net session >nul 2>&1
if errorlevel 1 (
  echo [X] Klik kanan uninstall.bat lalu pilih "Run as administrator".
  pause
  exit /b 1
)

for %%S in (caddy-service invoice-print-service) do (
  "%~dp0%%S.exe" stop
  "%~dp0%%S.exe" uninstall
)
netsh advfirewall firewall delete rule name="Invoice Print HTTP" >nul 2>&1

echo.
echo Service Invoice Print sudah dihapus. File di folder ini tidak dihapus.
pause
