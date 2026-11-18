// Data tetap yang tampil di cetakan invoice.
// Ubah di sini tanpa perlu menyentuh kode lain.

export default {
  company: {
    name: 'PT. Inti Bangun Selaras',
    addressLines: [
      'SOEWARNA BUSINESS PARK',
      'BLOK B LOT 6 NO. UNIT D7, PAJANG, BENDA, KOTA',
      'TANGERANG, BANTEN',
    ],
    phoneLine: 'Telp: 021-22566659; Fax: 021- 22566891',
    logo: 'img/logo.png', // ganti file public/img/logo.png dengan logo asli resolusi tinggi
  },

  // Tabel InvoiceHd tidak menyimpan data customer, jadi Bill To diambil dari sini.
  // Kalau nanti ada tabel customer, ambil dari database (lihat src/invoices.js).
  billTo: {
    name: 'PT. PANCA CITRA ABADI',
    addressLines: ['JL. KARTINI 2 NO. 17 PASAR BARU', '', 'SAWAH BESAR, JAKARTA PUSAT'],
    npwp: '031.770.195.1-075.000',
  },

  payment: {
    title: 'Payment should be made to:',
    lines: ['PT. INTI BANGUN SELARAS', 'BCA Branch Muara Karang - Jakarta', 'Ac No. 069-3151-888 (IDR)'],
  },

  noteLines: [
    'Perhitungan nilai DPP, PPN dan PPH  sudah mengikuti',
    'peraturan perpajakan PER-11/PJ/2025 (Pasal 128 dan Pasal 129)',
    'Pemotongan Pajak (Pph 23 atau Pph 4(2)) agar disesuaikan dengan',
    'peraturan perpajakan yang berlaku. Bukti Potong harap dikirimkan melalui',
    'email : aribs@ibs-logistik.co.id',
  ],

  copies: ['white : Customer', 'red : Accounting', 'yellow : Keuangan'],

  // VAT = DPP x 1.1% (PPN besaran tertentu jasa freight forwarding).
  // Dicek dari contoh: 25,835,401.88 x 1.1% = 284,189.42
  vatRate: 0.011,

  // Bea meterai Rp10.000 jika DPP + VAT > Rp5.000.000
  stampDuty: { amount: 10000, threshold: 5000000 },

  // Jumlah baris item per halaman; jika lebih, invoice lanjut ke halaman berikutnya
  itemsPerPage: 14,

  // Batas jumlah invoice per sekali cetak bulk
  maxPrint: 1000,
};
