// Membuat paket deploy Windows siap pakai: dist/invoice-print-windows.zip
// Isi: node.exe portable + aplikasi (1 file bundle) + Caddy + WinSW + skrip install.
// Di server tidak perlu Node.js, npm, maupun internet.
//
//   npm run build:windows

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import AdmZip from 'adm-zip';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const NODE_VERSION = process.env.NODE_WIN_VERSION || 'v22.22.3';
const WINSW_VERSION = 'v2.12.0';

const cacheDir = path.join(root, '.cache');
const distDir = path.join(root, 'dist');
const stage = path.join(distDir, 'invoice-print');
const zipPath = path.join(distDir, 'invoice-print-windows.zip');

const sha256 = (buf) => crypto.createHash('sha256').update(buf).digest('hex');
const crlf = (s) => s.replace(/\r?\n/g, '\r\n');
const out = (...p) => path.join(stage, ...p);

async function download(url, cacheName) {
  const file = path.join(cacheDir, cacheName);
  if (fs.existsSync(file)) return fs.readFileSync(file);
  console.log(`   unduh ${url}`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Gagal unduh ${url}: HTTP ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(file, buf);
  return buf;
}

fs.rmSync(distDir, { recursive: true, force: true });
fs.mkdirSync(out('src'), { recursive: true });

console.log('1/5 Bundle aplikasi + dependensi jadi 1 file');
await build({
  entryPoints: [path.join(root, 'src', 'server.js')],
  outfile: out('src', 'server.js'),
  bundle: true,
  platform: 'node',
  format: 'esm',
  target: 'node22',
  // dependensi CommonJS di dalam bundle ESM butuh `require`
  banner: { js: "import { createRequire as __createRequire } from 'node:module'; const require = __createRequire(import.meta.url);" },
  logLevel: 'error',
});

console.log(`2/5 Node.js ${NODE_VERSION} portable (win-x64)`);
const nodeZipName = `node-${NODE_VERSION}-win-x64.zip`;
const sums = (await download(`https://nodejs.org/dist/${NODE_VERSION}/SHASUMS256.txt`, `node-${NODE_VERSION}-SHASUMS256.txt`)).toString();
const nodeZip = await download(`https://nodejs.org/dist/${NODE_VERSION}/${nodeZipName}`, nodeZipName);
const expected = sums.split('\n').find((l) => l.trim().endsWith(`  ${nodeZipName}`))?.split(/\s+/)[0];
if (!expected || expected !== sha256(nodeZip)) throw new Error(`Checksum ${nodeZipName} tidak cocok dengan SHASUMS256.txt`);
const nodeArchive = new AdmZip(nodeZip);
fs.writeFileSync(out('node.exe'), nodeArchive.getEntry(`node-${NODE_VERSION}-win-x64/node.exe`).getData());
fs.writeFileSync(out('LICENSE-node.txt'), nodeArchive.getEntry(`node-${NODE_VERSION}-win-x64/LICENSE`).getData());

console.log(`3/5 WinSW ${WINSW_VERSION} (service wrapper)`);
const winsw = await download(`https://github.com/winsw/winsw/releases/download/${WINSW_VERSION}/WinSW-x64.exe`, `WinSW-x64-${WINSW_VERSION}.exe`);
fs.writeFileSync(out('invoice-print-service.exe'), winsw);
fs.writeFileSync(out('caddy-service.exe'), winsw);

console.log('4/5 Caddy, file aplikasi & skrip install');
fs.copyFileSync(path.join(root, 'deploy', 'caddy.exe'), out('caddy.exe'));
fs.copyFileSync(path.join(root, 'deploy', 'LICENSE-caddy.txt'), out('LICENSE-caddy.txt'));
fs.cpSync(path.join(root, 'public'), out('public'), { recursive: true });
fs.cpSync(path.join(root, 'config'), out('config'), { recursive: true });
fs.writeFileSync(out('.env.example'), crlf(fs.readFileSync(path.join(root, '.env.example'), 'utf8')));
fs.writeFileSync(out('package.json'), JSON.stringify({ name: 'invoice-print', private: true, type: 'module' }, null, 2));
for (const f of fs.readdirSync(path.join(root, 'deploy', 'windows'))) {
  // file .bat wajib CRLF agar dibaca benar oleh cmd.exe
  fs.writeFileSync(out(f), crlf(fs.readFileSync(path.join(root, 'deploy', 'windows', f), 'utf8')));
}

console.log('5/5 Membuat zip');
const zip = new AdmZip();
zip.addLocalFolder(stage, 'invoice-print');
zip.writeZip(zipPath);

const mb = (n) => `${(n / 1024 / 1024).toFixed(1)} MB`;
console.log(`\nSelesai: ${path.relative(root, zipPath)} (${mb(fs.statSync(zipPath).size)})`);
