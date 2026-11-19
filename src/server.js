import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import express from 'express';
import { getPool } from './db.js';
import { getInvoicesForPrint, listInvoiceNos, listInvoices } from './invoices.js';
import { renderPrintPage } from './render.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
try {
  process.loadEnvFile(path.join(root, '.env'));
} catch (err) {
  if (err.code !== 'ENOENT') throw err;
}

// Dibaca saat runtime (tidak ikut di-bundle) supaya config/company.js tetap bisa diedit di server
const cfg = (await import(pathToFileURL(path.join(root, 'config', 'company.js')).href)).default;

// `node src/server.js --check-db` : tes koneksi database lalu keluar
if (process.argv.includes('--check-db')) {
  try {
    const pool = await getPool();
    const { recordset } = await pool.request().query('SELECT COUNT(*) AS n FROM dbo.InvoiceHd');
    console.log(`[OK] Terhubung ke database ${process.env.DB_NAME || 'IBSFin'} di ${process.env.DB_SERVER || 'localhost'}: ${recordset[0].n} invoice.`);
    process.exit(0);
  } catch (err) {
    console.error(`[X] Gagal terhubung ke database: ${err.message}`);
    process.exit(1);
  }
}

const app = express();
app.disable('x-powered-by');
app.use(express.urlencoded({ extended: false, limit: '1mb', parameterLimit: 5000 }));
app.use(express.static(path.join(root, 'public')));

const filterFrom = (src) => ({ q: src.q, type: src.type, from: src.from, to: src.to });
const toArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

app.get('/api/invoices', async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const size = Math.min(200, Math.max(1, parseInt(req.query.size, 10) || 25));
  const data = await listInvoices(filterFrom(req.query), { page, size }, cfg);
  res.json({ page, size, ...data });
});

// GET  /print?no=CC25020000045&no=CC25020000045B -> cetak invoice tertentu
// POST /print  (no=...&no=...)                    -> cetak bulk pilihan (tanpa batas panjang URL)
// POST /print  (all=1&q=..&type=..&from=..&to=..) -> cetak semua hasil filter
async function printHandler(req, res) {
  const src = req.method === 'POST' ? req.body : req.query;
  let nos;
  if (src.all === '1') {
    nos = await listInvoiceNos(filterFrom(src), cfg.maxPrint);
  } else {
    nos = [...new Set(toArray(src.no).map((n) => String(n).trim()).filter(Boolean))];
  }
  if (nos.length > cfg.maxPrint) {
    return res.status(400).send(`Maksimal ${cfg.maxPrint} invoice per sekali cetak.`);
  }
  const invoices = nos.length ? await getInvoicesForPrint(nos, cfg) : [];
  const found = new Set(invoices.map((i) => i.no));
  const notFound = nos.filter((n) => !found.has(n));

  res.type('html').send(await renderPrintPage(invoices, cfg, { autoPrint: src.autoprint === '1', notFound }));
}
app.get('/print', printHandler);
app.post('/print', printHandler);

app.use((err, req, res, _next) => {
  console.error(err);
  const msg = err.code === 'ESOCKET' || err.code === 'ELOGIN' ? `Gagal konek ke database: ${err.message}` : 'Terjadi kesalahan server.';
  if (req.path.startsWith('/api/')) res.status(500).json({ error: msg });
  else res.status(500).type('text').send(msg);
});

const port = Number(process.env.PORT || 3000);
const host = process.env.HOST || '127.0.0.1';
// Express 5 meneruskan error listen (mis. port sudah dipakai) ke callback ini
app.listen(port, host, (err) => {
  if (err) {
    const hint = err.code === 'EADDRINUSE' ? ` Port ${port} sudah dipakai proses lain; hentikan proses itu atau ganti PORT di .env.` : '';
    console.error(`Gagal menjalankan server di ${host}:${port}: ${err.message}.${hint}`);
    process.exit(1);
  }
  console.log(`Invoice print berjalan di http://${host}:${port}`);
});
