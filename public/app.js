const $ = (id) => document.getElementById(id);
const form = $('filter');
const state = { page: 1, total: 0, rows: [], selected: new Set() };

const money = new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmtDate = (iso) => {
  if (!iso) return '';
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}-${MONTHS[d.getUTCMonth()]}-${d.getUTCFullYear()}`;
};

const filters = () => {
  const f = Object.fromEntries(new FormData(form));
  return { q: f.q.trim(), type: f.type, from: f.from, to: f.to, size: Number(f.size) };
};

async function load() {
  const f = filters();
  const params = new URLSearchParams({ page: state.page, size: f.size });
  for (const k of ['q', 'type', 'from', 'to']) if (f[k]) params.set(k, f[k]);

  $('rows').innerHTML = '<tr><td colspan="10" class="state">Memuat data&hellip;</td></tr>';
  try {
    const res = await fetch(`api/invoices?${params}`);
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || res.statusText);
    state.total = data.total;
    state.rows = data.rows;
  } catch (err) {
    state.total = 0;
    state.rows = [];
    const tr = document.createElement('tr');
    tr.append(Object.assign(document.createElement('td'), { colSpan: 10, className: 'state error', textContent: `Gagal memuat data: ${err.message}` }));
    $('rows').replaceChildren(tr);
    renderPager();
    renderSelection();
    return;
  }
  render();
}

function cell(text, className) {
  const td = document.createElement('td');
  td.textContent = text;
  if (className) td.className = className;
  return td;
}

function render() {
  const tbody = $('rows');
  tbody.innerHTML = '';
  if (!state.rows.length) {
    tbody.innerHTML = '<tr><td colspan="10" class="state">Tidak ada invoice yang cocok.</td></tr>';
  }
  for (const r of state.rows) {
    const tr = document.createElement('tr');
    tr.classList.toggle('selected', state.selected.has(r.no));

    const cb = Object.assign(document.createElement('input'), { type: 'checkbox', checked: state.selected.has(r.no) });
    cb.addEventListener('change', () => {
      cb.checked ? state.selected.add(r.no) : state.selected.delete(r.no);
      tr.classList.toggle('selected', cb.checked);
      renderSelection();
    });
    const tdCheck = document.createElement('td');
    tdCheck.append(cb);

    const printBtn = Object.assign(document.createElement('button'), { type: 'button', className: 'btn sm', textContent: 'Print' });
    printBtn.addEventListener('click', () => openPrint([['no', r.no]]));
    const tdPrint = document.createElement('td');
    tdPrint.append(printBtn);

    const tdType = document.createElement('td');
    tdType.append(Object.assign(document.createElement('span'), { className: `badge ${r.type.toLowerCase()}`, textContent: r.type }));

    tr.append(
      tdCheck,
      cell(r.no, 'inv-no'),
      tdType,
      cell(fmtDate(r.invDate), 'nowrap'),
      cell(fmtDate(r.dueDate), 'nowrap'),
      cell(r.desc, 'desc'),
      cell(r.itemCount, 'num'),
      cell(money.format(r.dpp), 'num'),
      cell(money.format(r.total), 'num'),
      tdPrint,
    );
    tbody.append(tr);
  }
  renderPager();
  renderSelection();
}

function renderPager() {
  const { size } = filters();
  const pages = Math.max(1, Math.ceil(state.total / size));
  const start = state.total ? (state.page - 1) * size + 1 : 0;
  const end = Math.min(state.page * size, state.total);
  $('pageInfo').textContent = `Menampilkan ${start}–${end} dari ${state.total} invoice`;
  $('pageNo').textContent = `Hal. ${state.page} / ${pages}`;
  $('prev').disabled = state.page <= 1;
  $('next').disabled = state.page >= pages;
  $('printAll').disabled = !state.total;
  $('printAll').textContent = `Print semua hasil filter (${state.total})`;
}

function renderSelection() {
  const n = state.selected.size;
  $('selCount').textContent = n;
  $('clearSel').hidden = !n;
  $('printSelected').disabled = !n;
  $('printSelected').textContent = n ? `Print terpilih (${n})` : 'Print terpilih';
  const onPage = state.rows.filter((r) => state.selected.has(r.no)).length;
  $('checkPage').checked = state.rows.length > 0 && onPage === state.rows.length;
  $('checkPage').indeterminate = onPage > 0 && onPage < state.rows.length;
}

// Kirim lewat POST ke tab baru, supaya ratusan nomor invoice tidak terbentur batas panjang URL
function openPrint(fields) {
  const f = Object.assign(document.createElement('form'), { method: 'POST', action: 'print', target: '_blank' });
  for (const [name, value] of [...fields, ['autoprint', '1']]) {
    f.append(Object.assign(document.createElement('input'), { type: 'hidden', name, value }));
  }
  document.body.append(f);
  f.submit();
  f.remove();
}

$('printSelected').addEventListener('click', () => {
  openPrint([...state.selected].sort().map((no) => ['no', no]));
});

$('printAll').addEventListener('click', () => {
  const f = filters();
  if (state.total > 200 && !confirm(`Cetak ${state.total} invoice sekaligus?`)) return;
  openPrint([['all', '1'], ['q', f.q], ['type', f.type], ['from', f.from], ['to', f.to]]);
});

$('checkPage').addEventListener('change', (e) => {
  for (const r of state.rows) e.target.checked ? state.selected.add(r.no) : state.selected.delete(r.no);
  render();
});
$('clearSel').addEventListener('click', () => {
  state.selected.clear();
  render();
});

form.addEventListener('submit', (e) => {
  e.preventDefault();
  state.page = 1;
  load();
});
form.addEventListener('reset', () => setTimeout(() => { state.page = 1; load(); }));
for (const el of [form.size, form.type]) el.addEventListener('change', () => { state.page = 1; load(); });
$('prev').addEventListener('click', () => { state.page--; load(); });
$('next').addEventListener('click', () => { state.page++; load(); });

load();
