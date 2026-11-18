// Perhitungan & format. Semua nilai uang dihitung dalam SEN (integer)
// supaya bebas error pembulatan floating point.

export const toCents = (v) => Math.round(Number(v || 0) * 100);

export function computeTotals(items, cfg) {
  const dpp = items.reduce((sum, it) => sum + toCents(it.Amount), 0);
  const vat = Math.round(+(dpp * cfg.vatRate).toFixed(6));
  const subtotal = dpp + vat;
  const stamp = subtotal > cfg.stampDuty.threshold * 100 ? cfg.stampDuty.amount * 100 : 0;
  return { dpp, vat, stamp, total: subtotal + stamp };
}

const moneyFmt = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const fmtMoney = (cents) => moneyFmt.format(cents / 100);
export const fmtQty = (v) => moneyFmt.format(Number(v || 0));

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = (n) => String(n).padStart(2, '0');

// Kolom datetime SQL Server dibaca driver mssql sebagai UTC (useUTC: true),
// jadi pakai getter UTC agar tanggal tidak bergeser karena zona waktu.
export const fmtDate = (d) =>
  d ? `${pad(d.getUTCDate())}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}` : '';

// Terbilang bahasa Inggris, format sama dengan contoh:
// "Twenty Six Million ... Ninety One point three zero Rupiah(s)"
const ONES = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const SCALES = ['', 'Thousand', 'Million', 'Billion', 'Trillion'];
const DIGITS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine'];

function below1000(n) {
  const out = [];
  if (n >= 100) {
    out.push(ONES[Math.floor(n / 100)], 'Hundred');
    n %= 100;
  }
  if (n >= 20) {
    out.push(TENS[Math.floor(n / 10)]);
    if (n % 10) out.push(ONES[n % 10]);
  } else if (n > 0) {
    out.push(ONES[n]);
  }
  return out.join(' ');
}

export function amountInWords(cents) {
  const negative = cents < 0;
  cents = Math.abs(cents);
  let whole = Math.floor(cents / 100);
  const decimals = String(cents % 100).padStart(2, '0');

  const parts = [];
  for (let i = 0; whole > 0; i++, whole = Math.floor(whole / 1000)) {
    const chunk = whole % 1000;
    if (chunk) parts.unshift(below1000(chunk) + (SCALES[i] ? ` ${SCALES[i]}` : ''));
  }
  const words = parts.length ? parts.join(' ') : 'Zero';
  return `${negative ? 'Minus ' : ''}${words} point ${DIGITS[decimals[0]]} ${DIGITS[decimals[1]]} Rupiah(s)`;
}
