@echo off
setlocal EnableExtensions
cd /d "%~dp0"
title Install Invoice Print

rem Port web dibaca otomatis dari alamat situs di Caddyfile (mis. baris ":3003 {").
set "WEB_PORT="
for /f "tokens=1 delims={ " %%P in ('findstr /r /b /c:":[0-9]" Caddyfile') do if not defined WEB_PORT set "WEB_PORT=%%P"
if defined WEB_PORT (set "WEB_PORT=%WEB_PORT:~1%") else (set "WEB_PORT=80")

echo ================================================
echo   INSTALL INVOICE PRINT
echo ================================================
echo.

net session >nul 2>&1
if errorlevel 1 (
  echo [X] Harus dijalankan sebagai Administrator.
  echo     Klik kanan install.bat lalu pilih "Run as administrator".
  goto :fail
)

echo [1/7] Membuka blokir file hasil download...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-ChildItem -LiteralPath '.' -Recurse | Unblock-File" >nul 2>&1

echo [2/7] Menyiapkan file .env ...
if not exist ".env" (
  copy /y ".env.example" ".env" >nul
  echo       Notepad akan terbuka. Isi koneksi database, SIMPAN, lalu TUTUP Notepad.
  start "" /wait notepad.exe ".env"
)

echo [3/7] Tes koneksi database...
"%~dp0node.exe" src\server.js --check-db
if errorlevel 1 (
  echo [X] Perbaiki isi .env ^(buka dengan Notepad^), lalu jalankan install.bat lagi.
  goto :fail
)

echo [4/7] Menghentikan service lama jika ada...
for %%S in (caddy-service invoice-print-service) do (
  "%~dp0%%S.exe" stop >nul 2>&1
  "%~dp0%%S.exe" uninstall >nul 2>&1
)
timeout /t 2 /nobreak >nul

echo [5/7] Cek port %WEB_PORT%...
netstat -ano | findstr /r /c:":%WEB_PORT% .*LISTENING" >nul
if not errorlevel 1 (
  echo [X] Port %WEB_PORT% sudah dipakai program lain.
  echo     Ganti port di Caddyfile ^(mis. ":3004 {"^), lalu jalankan install.bat lagi.
  echo     Cek program pemakai port: netstat -ano ^| findstr :%WEB_PORT%
  goto :fail
)

echo [6/7] Memasang service...
if not exist "logs" mkdir "logs"
for %%S in (invoice-print-service caddy-service) do (
  "%~dp0%%S.exe" install
  if errorlevel 1 goto :fail
  "%~dp0%%S.exe" start
  if errorlevel 1 goto :fail
)

echo [7/7] Membuka firewall port %WEB_PORT%...
netsh advfirewall firewall delete rule name="Invoice Print HTTP" >nul 2>&1
netsh advfirewall firewall add rule name="Invoice Print HTTP" dir=in action=allow protocol=TCP localport=%WEB_PORT% >nul

echo.
echo Menunggu aplikasi siap...
timeout /t 3 /nobreak >nul
powershell -NoProfile -Command "try { $r = Invoke-WebRequest -UseBasicParsing -TimeoutSec 15 'http://localhost:%WEB_PORT%/'; exit [int]($r.StatusCode -ne 200) } catch { exit 1 }"
if errorlevel 1 (
  echo [X] Service sudah terpasang tetapi halaman belum bisa dibuka.
  echo     Lihat file log di folder logs\
  goto :fail
)

set "SUFFIX="
if not "%WEB_PORT%"=="80" set "SUFFIX=:%WEB_PORT%"
echo.
echo ================================================
echo   SELESAI. Buka di browser:
echo     http://localhost%SUFFIX%
for /f "tokens=2 delims=:" %%I in ('ipconfig ^| findstr /c:"IPv4"') do for /f "tokens=*" %%J in ("%%I") do echo     http://%%J%SUFFIX%
echo ================================================
echo.
pause
exit /b 0

:fail
echo.
echo Instalasi BELUM berhasil.
pause
exit /b 1
