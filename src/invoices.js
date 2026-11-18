import { getPool, sql } from './db.js';
import { computeTotals } from './calc.js';

// Satu baris InvoiceHd = satu invoice cetak:
//   - Freight  : nomor tanpa akhiran "B" (mis. CC25020000045)
//   - Handling : nomor berakhiran "B"    (mis. CC25020000045B)
// Detail diambil dari InvoiceDt dengan NoInv yang sama persis.
// Semua query kompatibel dengan SQL Server 2016 (tanpa STRING_AGG, GREATEST, dsb).

export const TYPES = ['Freight', 'Handling'];
export const invoiceType = (no) => (no.endsWith('B') ? 'Handling' : 'Freight');

const FILTER = `
WHERE (@q IS NULL OR h.NoInv LIKE @q OR h.InvDesc LIKE @q)
  AND (@type IS NULL
       OR (@type = 'Handling' AND RIGHT(h.NoInv, 1) = 'B')
       OR (@type = 'Freight'  AND RIGHT(h.NoInv, 1) <> 'B'))
  AND (@from IS NULL OR h.InvDate >= CAST(@from AS date))
  AND (@to   IS NULL OR h.InvDate <  DATEADD(DAY, 1, CAST(@to AS date)))`;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const escapeLike = (s) => s.replace(/[[%_]/g, (c) => `[${c}]`);

function bindFilter(req, { q, type, from, to }) {
  q = (q || '').trim();
  req.input('q', sql.VarChar(200), q ? `%${escapeLike(q)}%` : null);
  req.input('type', sql.VarChar(10), TYPES.includes(type) ? type : null);
  req.input('from', sql.VarChar(10), DATE_RE.test(from || '') ? from : null);
  req.input('to', sql.VarChar(10), DATE_RE.test(to || '') ? to : null);
  return req;
}

/** Daftar invoice dengan filter & paging. */
export async function listInvoices(filter, { page = 1, size = 25 }, cfg) {
  const pool = await getPool();
  const req = bindFilter(pool.request(), filter);
  req.input('offset', sql.Int, (page - 1) * size);
  req.input('size', sql.Int, size);

  const { recordset } = await req.query(`
SELECT h.NoInv, h.InvDate, h.InvJTDate, h.InvDesc,
       ISNULL(a.Dpp, 0) AS Dpp, ISNULL(a.ItemCount, 0) AS ItemCount,
       COUNT(*) OVER () AS TotalRows
FROM dbo.InvoiceHd h
OUTER APPLY (
  SELECT SUM(d.Amount) AS Dpp, COUNT(*) AS ItemCount
  FROM dbo.InvoiceDt d
  WHERE d.NoInv = h.NoInv
) a
${FILTER}
ORDER BY h.InvDate DESC, h.NoInv DESC
OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY;`);

  return {
    total: recordset[0]?.TotalRows ?? 0,
    rows: recordset.map((r) => {
      const t = computeTotals([{ Amount: r.Dpp }], cfg);
      return {
        no: r.NoInv,
        type: invoiceType(r.NoInv),
        invDate: r.InvDate,
        dueDate: r.InvJTDate,
        desc: r.InvDesc,
        itemCount: r.ItemCount,
        dpp: t.dpp / 100,
        total: t.total / 100,
      };
    }),
  };
}

/** Semua nomor invoice yang cocok dengan filter (untuk "print semua hasil filter"). */
export async function listInvoiceNos(filter, limit) {
  const pool = await getPool();
  const req = bindFilter(pool.request(), filter);
  req.input('limit', sql.Int, limit);
  const { recordset } = await req.query(`
SELECT TOP (@limit) h.NoInv
FROM dbo.InvoiceHd h
${FILTER}
ORDER BY h.NoInv;`);
  return recordset.map((r) => r.NoInv);
}

/** Ambil header + detail lengkap untuk dicetak. */
export async function getInvoicesForPrint(nos, cfg) {
  const pool = await getPool();
  const headers = [];
  const details = [];

  // SQL Server membatasi 2100 parameter per query, jadi dipecah per 1000 nomor
  for (let i = 0; i < nos.length; i += 1000) {
    const chunk = nos.slice(i, i + 1000);
    const req = pool.request();
    chunk.forEach((no, j) => req.input(`n${j}`, sql.VarChar(30), no));
    const list = chunk.map((_, j) => `@n${j}`).join(', ');
    const { recordsets } = await req.query(`
SELECT NoInv, InvType, InvDate, InvJTDate, InvDesc
FROM dbo.InvoiceHd
WHERE NoInv IN (${list});

SELECT NoInv, ServChargeID, SerChargeName, Qty, Unit, UnitPrice, Amount
FROM dbo.InvoiceDt
WHERE NoInv IN (${list});`);
    headers.push(...recordsets[0]);
    details.push(...recordsets[1]);
  }

  const itemsByNo = new Map();
  for (const d of details) {
    if (!itemsByNo.has(d.NoInv)) itemsByNo.set(d.NoInv, []);
    itemsByNo.get(d.NoInv).push(d);
  }

  return headers
    .sort((a, b) => a.NoInv.localeCompare(b.NoInv))
    .map((h) => {
      // Urutan item: nominal terkecil dulu (mengikuti contoh cetakan)
      const items = (itemsByNo.get(h.NoInv) ?? []).sort((x, y) => x.Amount - y.Amount);
      return {
        no: h.NoInv,
        type: invoiceType(h.NoInv),
        invDate: h.InvDate,
        dueDate: h.InvJTDate,
        desc: h.InvDesc,
        items,
        totals: computeTotals(items, cfg),
      };
    });
}
