# Invoice Print

Aplikasi sederhana Node.js untuk menampilkan daftar invoice dari database **IBSFin**
(SQL Server) dan mencetaknya sesuai format invoice PT. Inti Bangun Selaras, satuan maupun bulk.

- Daftar invoice dengan pencarian (no. invoice / description), filter jenis (Freight / Handling), filter tanggal, dan paging.
- Cetak satu invoice (tombol **Print** per baris).
- Cetak bulk: centang beberapa invoice (bisa lintas halaman) lalu **Print terpilih**,
  atau **Print semua hasil filter**.
- Hasil cetak berukuran A4, 1 invoice per halaman. Bisa langsung ke printer atau
  *Save as PDF* dari dialog print browser.

## Cara kerja data

| Hal | Aturan |
|---|---|
| 1 invoice cetak | 1 baris `InvoiceHd` |
| Jenis | **Freight** = nomor tanpa akhiran B (`CC25020000045`), **Handling** = nomor berakhiran B (`CC25020000045B`) |
| Item | `InvoiceDt` dengan `NoInv` yang sama persis, urut nominal terkecil dulu |
| DPP | Jumlah `Amount` |
| VAT | DPP x 1.1% |
| Stamp | Rp10.000 jika DPP + VAT > Rp5.000.000 |
| QR code | Berisi nomor invoice |
| Bill To, alamat, bank, catatan | Diambil dari `config/company.js` (tidak ada di database) |

Semua query kompatibel dengan **SQL Server 2016** (tidak memakai STRING_AGG, GREATEST, dsb).

## Struktur

```
config/company.js   data tetap invoice (kop, Bill To, bank, catatan, tarif VAT, meterai)
src/server.js       web server Express + route
src/invoices.js     query SQL Server
src/render.js       template HTML cetak
src/calc.js         perhitungan total, format angka & tanggal, terbilang
public/             halaman daftar (index.html, app.js, style.css), print.css, logo
Caddyfile           contoh reverse proxy
```

## Menjalankan di lokal

Butuh Node.js 20.12+ (disarankan 22 LTS).

```bash
npm install
cp .env.example .env      # isi koneksi database
npm run dev               # auto-restart saat file berubah
```

Buka http://localhost:3000

## Deploy di Windows Server 2022 (cara paling mudah)

Buat paket siap pakai di komputer development (butuh internet, sekali saja):

```bash
npm install
npm run build:windows      # hasil: dist/invoice-print-windows.zip (~66 MB)
```

Zip berisi `node.exe` portable, aplikasi dalam 1 file, Caddy, WinSW, dan skrip install.
Di server **tidak perlu** install Node.js, npm, maupun internet:

1. Salin zip ke server, ekstrak ke `C:\apps` (hasilnya `C:\apps\invoice-print`).
2. Klik kanan `install.bat` → *Run as administrator*.
3. Isi `.env` di Notepad yang terbuka, simpan, tutup.
4. Tunggu sampai muncul **SELESAI**, lalu buka `http://<IP-server>:3003`.

`install.bat` mengecek koneksi database dan port web (dibaca dari `Caddyfile`, default 3003), memasang 2 Windows service
(*Invoice Print* dan *Invoice Print (Caddy)*), membuka firewall, lalu memastikan
halaman bisa dibuka. Aman dijalankan ulang. Petunjuk lengkap ada di `BACA-SAYA.txt`
di dalam zip; template skripnya ada di `deploy/windows/`.

## Deploy di Windows Server 2022 (manual)

1. Install **Node.js LTS** (.msi). Caddy v2.11.9 sudah tersedia di `deploy\caddy.exe`;
   salin ke `C:\caddy\caddy.exe`.
2. Salin folder ini ke mis. `C:\apps\invoice-print`, lalu di PowerShell:
   ```powershell
   cd C:\apps\invoice-print
   npm ci --omit=dev
   copy .env.example .env    # lalu edit .env
   ```
3. Jalankan aplikasi sebagai Windows service dengan [WinSW](https://github.com/winsw/winsw)
   (konfigurasi sudah ada di `invoice-print-service.xml`). PowerShell **as Administrator**:
   ```powershell
   cd C:\apps\invoice-print
   Invoke-WebRequest https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe -OutFile invoice-print-service.exe
   .\invoice-print-service.exe install
   .\invoice-print-service.exe start
   .\invoice-print-service.exe status     # harus "Started"
   ```
   Service muncul di `services.msc` dengan nama **Invoice Print**, otomatis jalan saat
   server boot dan restart sendiri jika crash. Log ada di `invoice-print-service.out.log`
   dan `.err.log`. Setelah update kode (`git pull`), jalankan `.\invoice-print-service.exe restart`.
4. Salin `Caddyfile` ke `C:\caddy\Caddyfile`, pilih blok A atau B, lalu daftarkan Caddy:
   ```powershell
   sc.exe create caddy start= auto binPath= "C:\caddy\caddy.exe run --config C:\caddy\Caddyfile"
   sc.exe start caddy
   # Blok A (port 3003):
   New-NetFirewallRule -DisplayName "Invoice Print 3003" -Direction Inbound -Protocol TCP -LocalPort 3003 -Action Allow
   # Blok B (domain + HTTPS) butuh port 80 dan 443:
   # New-NetFirewallRule -DisplayName "Web 80/443" -Direction Inbound -Protocol TCP -LocalPort 80,443 -Action Allow
   ```
   Jika port yang dipilih sudah dipakai program lain (mis. IIS di port 80), ganti port di Caddyfile.

## Tips mencetak

- Gunakan Chrome atau Edge. Pada dialog print: kertas **A4**, skala **100%** (Default).
- Header/footer browser (URL, tanggal) otomatis hilang karena margin halaman diatur 0.
- Maksimal 1000 invoice per sekali cetak (bisa diubah di `config/company.js` → `maxPrint`).

## Yang perlu disesuaikan

- `public/img/logo.png` masih hasil potongan dari scan. Ganti dengan file logo asli.
- Bill To saat ini satu customer tetap (PT. PANCA CITRA ABADI). Kalau customer berbeda per
  invoice, data customer perlu diambil dari tabel lain di database.
- Ada 25 nomor `...B` di `InvoiceDt` yang tidak punya header di `InvoiceHd`
  (mis. `CC25020000047B`), sehingga tidak muncul di daftar.
