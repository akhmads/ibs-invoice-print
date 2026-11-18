import QRCode from 'qrcode';
import { amountInWords, fmtDate, fmtMoney, fmtQty } from './calc.js';

const esc = (v) =>
  String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

const lines = (arr) => arr.map((l) => `<div>${l ? esc(l) : '&nbsp;'}</div>`).join('');

function header(cfg, inv, pageNo, pageCount) {
  const { company } = cfg;
  return `
  <header class="head">
    <div class="co">
      <img class="co-logo" src="${esc(company.logo)}" alt="">
      <div class="co-text">
        <div class="co-name">${esc(company.name)}</div>
        ${lines(company.addressLines)}
        <div>${esc(company.phoneLine)}</div>
      </div>
    </div>
    <div class="title">
      <div class="title-word">INVOICE</div>
      <div class="title-no"><span class="lbl">Invoice No.</span> : ${esc(inv.no)}</div>
      <div class="title-page">Page : ${pageNo} of ${pageCount}</div>
    </div>
  </header>

  <section class="mid">
    <div class="box billto">
      <div class="b">Bill To :</div>
      <div class="cust-name">${esc(cfg.billTo.name)}</div>
      <div class="cust-addr">${lines(cfg.billTo.addressLines)}</div>
      <div class="cust-npwp">${esc(cfg.billTo.npwp)}</div>
    </div>
    <div class="mid-right">
      <div class="dates">
        <div class="box date"><div class="dh">Invoice Date</div><div class="dv">${fmtDate(inv.invDate)}</div></div>
        <div class="box date"><div class="dh">Due Date</div><div class="dv">${fmtDate(inv.dueDate)}</div></div>
      </div>
      <div class="box desc">
        <div class="b">Description :</div>
        <div class="desc-text">${esc(inv.desc)}</div>
      </div>
    </div>
  </section>`;
}

function itemsTable(items, startNo) {
  const rows = items
    .map(
      (it, i) => `
      <tr>
        <td class="c-no">${startNo + i}</td>
        <td class="c-desc">${esc(it.SerChargeName)}</td>
        <td class="c-qty">${fmtQty(it.Qty)}</td>
        <td class="c-unit">${esc(it.Unit)}</td>
        <td class="c-price">${fmtMoney(Math.round(it.UnitPrice * 100))}</td>
        <td class="c-amt">${fmtMoney(Math.round(it.Amount * 100))}</td>
      </tr>`,
    )
    .join('');
  return `
  <table class="items">
    <colgroup>
      <col class="w-no"><col class="w-desc"><col class="w-qty"><col class="w-unit"><col class="w-price"><col class="w-amt">
    </colgroup>
    <thead>
      <tr><th>No</th><th>Detail Transaction</th><th>Qty</th><th>Unit</th><th>Unit Price</th><th>Amount (IDR)</th></tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>`;
}

function footer(cfg, inv, qrSvg) {
  const t = inv.totals;
  return `
  <section class="bottom">
    <div class="says"><span class="b">Says :</span><span class="says-text">${esc(amountInWords(t.total))}</span></div>

    <div class="sign sign-1"><div class="b">Prepared By,</div><div class="sign-line"></div></div>
    <div class="sign sign-2"><div class="b">Received By,</div><div class="sign-line"></div></div>

    ${cfg.copies.map((c, i) => `<div class="copy copy-${i + 1}">${esc(c)}</div>`).join('')}

    <div class="qr">${qrSvg}</div>

    <div class="totals">
      <div class="t-lbl">DPP :</div><div class="t-val">${fmtMoney(t.dpp)}</div>
      <div class="t-lbl">VAT :</div><div class="t-val">${fmtMoney(t.vat)}</div>
      <div class="t-lbl">Stamp :</div><div class="t-val">${fmtMoney(t.stamp)}</div>
      <div class="t-lbl t-grand">Total Invoice :</div><div class="t-val t-grand">${fmtMoney(t.total)}</div>
    </div>

    <div class="box pay">
      <div>${esc(cfg.payment.title)}</div>
      <div class="pay-lines">${lines(cfg.payment.lines)}</div>
    </div>

    <div class="note">
      <span>Note :</span>
      <div>${lines(cfg.noteLines)}</div>
    </div>
  </section>`;
}

async function renderInvoice(inv, cfg) {
  const qrSvg = await QRCode.toString(inv.no, { type: 'svg', margin: 0, errorCorrectionLevel: 'L' });
  const per = cfg.itemsPerPage;
  const chunks = [];
  for (let i = 0; i < Math.max(inv.items.length, 1); i += per) chunks.push(inv.items.slice(i, i + per));

  return chunks
    .map((chunk, idx) => {
      const isLast = idx === chunks.length - 1;
      return `
<article class="sheet">
  ${header(cfg, inv, idx + 1, chunks.length)}
  ${itemsTable(chunk, idx * per + 1)}
  ${isLast ? footer(cfg, inv, qrSvg) : '<div class="continued">continued on next page &rarr;</div>'}
</article>`;
    })
    .join('');
}

export async function renderPrintPage(invoices, cfg, { autoPrint = false, notFound = [] } = {}) {
  const sheets = [];
  for (const inv of invoices) sheets.push(await renderInvoice(inv, cfg));
  const sheetCount = sheets.join('').split('class="sheet"').length - 1;

  const missing = notFound.length
    ? `<span class="warn">Tidak ditemukan: ${esc(notFound.join(', '))}</span>`
    : '';
  const title = invoices.length === 1 ? `Invoice ${invoices[0].no}` : `Invoice (${invoices.length})`;

  return `<!doctype html>
<html lang="id">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<link rel="stylesheet" href="print.css">
</head>
<body>
<div class="toolbar">
  <div><b>${invoices.length}</b> invoice &middot; <b>${sheetCount}</b> halaman A4 ${missing}</div>
  <div class="toolbar-actions">
    <button type="button" onclick="window.print()">Print</button>
    <button type="button" class="ghost" onclick="window.close()">Tutup</button>
  </div>
</div>
${invoices.length ? sheets.join('') : '<p class="empty">Tidak ada invoice untuk dicetak.</p>'}
${autoPrint && invoices.length ? '<script>addEventListener("load", () => setTimeout(() => window.print(), 300));</script>' : ''}
</body>
</html>`;
}
