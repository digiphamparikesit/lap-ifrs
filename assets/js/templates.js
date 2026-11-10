// assets/js/templates.js
export const TEMPLATES = {
  // 1. RAWAT JALAN (Tanpa Shift)
  rj: {
    key: 'rj',
    nama: 'DEPO FARMASI RAWAT JALAN',
    punyaShift: false,
    fields: [
      { id: 'tanggal', label: 'Tanggal Input Laporan', type: 'date', required: true, group: 'Umum' },
      { id: 'petugas', label: 'Nama Petugas', type: 'petugas', required: true, group: 'Umum' },
      { id: 'jam_awal_pagi', label: 'Jam Awal Resep Poliklinik Pagi', type: 'time', group: 'Poliklinik Pagi' },
      { id: 'jam_akhir_pagi', label: 'Jam Akhir Resep Poliklinik Pagi', type: 'time', group: 'Poliklinik Pagi' },
      { id: 'resep_poli_pertama', label: 'Resep Poliklinik Pertama Masuk', type: 'number', min: 0, metric: true, group: 'Poliklinik Pagi' },
      { id: 'resep_poli_terakhir', label: 'Resep Poliklinik Terakhir Masuk', type: 'number', min: 0, metric: true, group: 'Poliklinik Pagi' },
      { id: 'racikan_pagi', label: 'Jumlah Resep Racikan (Poli Pagi)', type: 'number', min: 0, metric: true, group: 'Poliklinik Pagi' },
      { id: 'jam_awal_sore', label: 'Jam Awal Resep Poliklinik Sore', type: 'time', group: 'Poliklinik Sore' },
      { id: 'jam_akhir_sore', label: 'Jam Akhir Resep Poliklinik Sore', type: 'time', group: 'Poliklinik Sore' },
      { id: 'racikan_sore', label: 'Jumlah Resep Racikan (Poli Sore)', type: 'number', min: 0, metric: true, group: 'Poliklinik Sore' },
      { id: 'konseling', label: 'Jumlah Kegiatan Konseling', type: 'number', min: 0, metric: true, group: 'Total' },
      { id: 'total_resep', label: 'Jumlah Total Resep Harian', type: 'number', min: 0, metric: true, group: 'Total' },
      { id: 'obat_tidak_terlayani', label: 'Daftar Obat Tidak Terlayani', type: 'text', group: 'Total' },
    ],
  },

  // 2. RAWAT JALAN MATERNITAS
  rj_maternitas: {
    key: 'rj_maternitas',
    nama: 'DEPO FARMASI RAWAT JALAN MATERNITAS',
    punyaShift: false,
    fields: [
      { id: 'tanggal', label: 'Tanggal Input Laporan', type: 'date', required: true, group: 'Umum' },
      { id: 'petugas', label: 'Nama Petugas', type: 'petugas', required: true, group: 'Umum' },
      { id: 'jam_awal_pagi', label: 'Jam Awal Resep Poliklinik Pagi', type: 'time', group: 'Poliklinik Pagi' },
      { id: 'jam_akhir_pagi', label: 'Jam Akhir Resep Poliklinik Pagi', type: 'time', group: 'Poliklinik Pagi' },
      { id: 'resep_poli_pertama', label: 'Resep Poliklinik Pertama Masuk', type: 'number', min: 0, metric: true, group: 'Poliklinik Pagi' },
      { id: 'resep_poli_terakhir', label: 'Resep Poliklinik Terakhir Masuk', type: 'number', min: 0, metric: true, group: 'Poliklinik Pagi' },
      { id: 'racikan_pagi', label: 'Jumlah Resep Racikan (Poli Pagi)', type: 'number', min: 0, metric: true, group: 'Poliklinik Pagi' },
      { id: 'jam_awal_sore', label: 'Jam Awal Resep Poliklinik Sore', type: 'time', group: 'Poliklinik Sore' },
      { id: 'jam_akhir_sore', label: 'Jam Akhir Resep Poliklinik Sore', type: 'time', group: 'Poliklinik Sore' },
      { id: 'racikan_sore', label: 'Jumlah Resep Racikan (Poli Sore)', type: 'number', min: 0, metric: true, group: 'Poliklinik Sore' },
      { id: 'konseling', label: 'Jumlah Kegiatan Konseling', type: 'number', min: 0, metric: true, group: 'Total' },
      { id: 'total_resep', label: 'Jumlah Total Resep Harian', type: 'number', min: 0, metric: true, group: 'Total' },
      { id: 'obat_tidak_terlayani', label: 'Daftar Obat Tidak Terlayani', type: 'text', group: 'Total' },
    ],
  },

  // 3. IRIN DAN MATERNITAS
  irin_mat: {
    key: 'irin_mat',
    nama: 'DEPO FARMASI IRIN DAN MATERNITAS',
    punyaShift: true,
    fields: [
      { id: 'tanggal', label: 'Tanggal Input Laporan', type: 'date', required: true, group: 'Umum' },
      { id: 'shift', label: 'Jadwal Shift', type: 'select', required: true, group: 'Umum',
        opsi: [{ value: 'pagi', label: 'Pagi' }, { value: 'middle', label: 'Middle' }, { value: 'sore', label: 'Sore' }] },
      { id: 'petugas', label: 'Nama Petugas', type: 'petugas', required: true, group: 'Umum' },
      { id: 'resep_per_shift', label: 'Jumlah Resep Per-Shift', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'resep_obat_pulang', label: 'Jumlah Resep Obat Pulang', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'resep_racikan', label: 'Jumlah Resep Racikan', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'resep_elektrolit', label: 'Jumlah Resep Elektrolit Pekat', type: 'number', min: 0, metric: true, group: 'Resep' },
    ],
  },

  // 4. IGD
  igd: {
    key: 'igd',
    nama: 'DEPO FARMASI IGD',
    punyaShift: true,
    fields: [
      { id: 'tanggal', label: 'Tanggal Input Laporan', type: 'date', required: true, group: 'Umum' },
      { id: 'shift', label: 'Jadwal Shift', type: 'select', required: true, group: 'Umum',
        opsi: [{ value: 'pagi', label: 'Pagi' }, { value: 'middle', label: 'Middle' }, { value: 'sore', label: 'Sore' }] },
      { id: 'petugas', label: 'Nama Petugas', type: 'petugas', required: true, group: 'Umum' },
      { id: 'resep_terlayani', label: 'Jumlah Resep Terlayani', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'resep_elektrolit', label: 'Jumlah Resep Elektrolit Pekat', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'resep_tpn', label: 'Jumlah Resep TPN', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'racikan_puyer', label: 'Jumlah Resep Racikan (Puyer)', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'racikan_salep', label: 'Jumlah Resep Racikan (Salep/Cream)', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'tambahan_resep_ranap', label: 'Jumlah Tambahan Resep Rawat Inap', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'pasien_tertahan', label: 'Jumlah Pasien Tertahan di IGD', type: 'number', min: 0, metric: true, group: 'Pasien' },
      { id: 'pasien_pindah_ranap', label: 'Jumlah Pasien Pindah Ruang Rawat Inap', type: 'number', min: 0, metric: true, group: 'Pasien' },
      { id: 'pasien_kode_merah', label: 'Jumlah Pasien Kode Merah', type: 'number', min: 0, metric: true, group: 'Pasien' },
      { id: 'pasien_pulang', label: 'Jumlah Pasien Pulang', type: 'number', min: 0, metric: true, group: 'Pasien' },
    ],
  },

  // 5. IBS
  ibs: {
    key: 'ibs',
    nama: 'DEPO FARMASI IBS',
    punyaShift: true,
    fields: [
      { id: 'tanggal', label: 'Tanggal Input Laporan IBS', type: 'date', required: true, group: 'Umum' },
      { id: 'shift', label: 'Jadwal Shift', type: 'select', required: true, group: 'Umum',
        opsi: [{ value: 'pagi', label: 'Pagi' }, { value: 'middle', label: 'Middle' }, { value: 'sore', label: 'Sore' }] },
      { id: 'petugas', label: 'Nama Petugas', type: 'petugas', required: true, group: 'Umum' },
      { id: 'operasi_elektif', label: 'Jumlah Operasi Elektif', type: 'number', min: 0, metric: true, group: 'Operasi' },
      { id: 'operasi_cito', label: 'Jumlah Operasi Cito', type: 'number', min: 0, metric: true, group: 'Operasi' },
      { id: 'operasi_mata', label: 'Jumlah Operasi Mata', type: 'number', min: 0, metric: true, group: 'Operasi' },
      { id: 'pasien_bpjs', label: 'Status Pasien BPJS', type: 'number', min: 0, metric: true, group: 'Status Pasien' },
      { id: 'pasien_cash', label: 'Status Pasien Cash', type: 'number', min: 0, metric: true, group: 'Status Pasien' },
      { id: 'pasien_perusahaan', label: 'Status Pasien Perusahaan', type: 'number', min: 0, metric: true, group: 'Status Pasien' },
    ],
  },

  // 6. IRNA 1
  irna1: {
    key: 'irna1',
    nama: 'DEPO FARMASI IRNA 1 DAN PAVILIUN',
    punyaShift: true,
    fields: [
      { id: 'tanggal', label: 'Tanggal Input Laporan', type: 'date', required: true, group: 'Umum' },
      { id: 'shift', label: 'Jadwal Shift', type: 'select', required: true, group: 'Umum',
        opsi: [{ value: 'pagi', label: 'Pagi' }, { value: 'middle', label: 'Middle' }, { value: 'sore', label: 'Sore' }] },
      { id: 'petugas', label: 'Nama Petugas', type: 'petugas', required: true, group: 'Umum' },
      { id: 'resep_per_shift', label: 'Jumlah Resep Per-Shift', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'racikan_puyer', label: 'Jumlah Resep Racikan (Puyer)', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'racikan_salep', label: 'Jumlah Resep Racikan (Salep/Cream)', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'resep_elektrolit', label: 'Jumlah Resep Elektrolit Pekat', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'resep_tpn', label: 'Jumlah Resep TPN/IV Admixture Rawat Inap', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'resep_pasien_pulang', label: 'Jumlah Resep Pasien Pulang', type: 'number', min: 0, metric: true, group: 'Resep' },
      { id: 'pasien_hemodialisa', label: 'Jumlah Pasien Hemodialisa', type: 'number', min: 0, metric: true, group: 'Pasien' },
      { id: 'pasien_konseling', label: 'Jumlah Pasien Konseling', type: 'number', min: 0, metric: true, group: 'Pasien' },
    ],
  },

  // 7. ONKOLOGI
    onkologi: {
    key: 'onkologi',
    nama: 'DEPO FARMASI ONKOLOGI TERPADU',
    punyaShift: true,
    fields: [
      { id: 'tanggal', label: 'Tanggal Input Laporan', type: 'date', required: true, group: 'Umum' },
      { id: 'shift', label: 'Jadwal Shift', type: 'select', required: true, group: 'Umum',
        opsi: [{ value: 'pagi', label: 'Pagi' }, { value: 'middle', label: 'Middle' }, { value: 'sore', label: 'Sore' }] },
      { id: 'petugas', label: 'Nama Petugas', type: 'petugas', required: true, group: 'Umum' },
      
      { id: 'jumlah_pasien_kemoterapi', label: 'Jumlah Pasien Kemoterapi', type: 'number', min: 0, metric: true, group: 'Sediaan IV' },
      { id: 'jumlah_sediaan_iv_admixture_sitostatika', label: 'Jumlah Sediaan IV Admixture Sitostatika', type: 'number', min: 0, metric: true, group: 'Sediaan IV' },
      { id: 'jumlah_sediaan_iv_admixture_tpn', label: 'Jumlah Sediaan IV Admixture TPN', type: 'number', min: 0, metric: true, group: 'Sediaan IV' },
      { id: 'jumlah_sediaan_iv_admixture_elektrolit_pekat', label: 'Jumlah Sediaan IV Admixture Elektrolit Pekat', type: 'number', min: 0, metric: true, group: 'Sediaan IV' },

      // --- BAGIAN INI KITA HAPUS / JADIKAN KOMENTAR ---
      // { id: 'jumlah_pasien_ruangan_picu', label: 'Jumlah Pasien Ruangan PICU', type: 'number', min: 0, metric: true, group: 'Pasien per Ruangan' },
      // { id: 'jumlah_pasien_ruangan_perinatologi', label: 'Jumlah Pasien Ruangan Perinatologi', type: 'number', min: 0, metric: true, group: 'Pasien per Ruangan' },
      // { id: 'jumlah_pasien_ruangan_enggang_2_anak', label: 'Jumlah Pasien Ruangan Enggang 2 Anak', type: 'number', min: 0, metric: true, group: 'Pasien per Ruangan' },
      // { id: 'jumlah_pasien_ruangan_vip_punai_1', label: 'Jumlah Pasien Ruangan VIP Punai 1', type: 'number', min: 0, metric: true, group: 'Pasien per Ruangan' },
      // { id: 'jumlah_pasien_ruangan_intermediate_upss_', label: 'Jumlah Pasien Ruangan Intermediate (UPSS)', type: 'number', min: 0, metric: true, group: 'Pasien per Ruangan' },
    ],
  },
};

// ==========================================
// FUNGSI BANTU (JANGAN DIHAPUS)
// ==========================================
export function getTemplate(key) {
  return TEMPLATES[key] || null;
}

export function getMetricFields(templateKey) {
  const t = TEMPLATES[templateKey];
  if (!t) return [];
  return t.fields.filter(f => f.metric).map(f => ({ id: f.id, label: f.label }));
}

export function getGroups(templateKey) {
  const t = TEMPLATES[templateKey];
  if (!t) return [];
  const seen = new Set();
  const out = [];
  for (const f of t.fields) {
    if (!seen.has(f.group)) { seen.add(f.group); out.push(f.group); }
  }
  return out;
}

export function getField(templateKey, fieldId) {
  const t = TEMPLATES[templateKey];
  return t ? t.fields.find(f => f.id === fieldId) : null;
}
