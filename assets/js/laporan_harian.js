// assets/js/laporan_harian.js
import { supabase } from './supabase.js';
import { getTemplate } from './templates.js';

// KONFIGURASI SAMA PERSIS DENGAN DASHBOARD.JS
const DEFAULT_METRICS = {
  'ibs': 'jumlah_operasi_elektif',
  'igd': 'jumlah_resep_terlayani',
  'irin_mat': 'jumlah_resep', 
  'irna1': 'jumlah_resep_per_shift',
  'onkologi': 'jumlah_sediaan_iv_admixture_sitostatika',
  'rj': 'jumlah_total_resep_harian',
  'rj_maternitas': 'jumlah_total_resep_harian'
};

export async function renderLaporanHarian(container, state) {
  // Tampilan Filter (Hanya Tanggal)
  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Laporan Harian Terpadu</h2>
      <p style="color:var(--gray-500); margin-bottom:16px;">Melihat semua pelayanan di setiap ruangan pada tanggal tertentu.</p>
      
      <div class="filter-bar" style="align-items:flex-end; display:flex; flex-wrap:wrap; gap:12px; background:#fff; padding:16px; border-radius:12px; border:1px solid var(--gray-200); margin-bottom:24px;">
        
        <div class="form-group" style="margin:0; flex:1; min-width:250px;">
          <label style="font-size:.75rem;">Pilih Tanggal Laporan</label>
          <input type="text" id="filter-tanggal-harian" class="form-control" placeholder="Pilih tanggal..." readonly>
        </div>
        
        <div style="display:flex; gap:8px;">
          <button id="btn-export-excel-harian" class="btn-secondary" style="padding: 8px 12px;">📊 Excel</button>
          <button id="btn-export-pdf-harian" class="btn-secondary" style="padding: 8px 12px;">📄 PDF</button>
        </div>
      </div>
    </div>

    <div id="harian-grid" style="display:flex; flex-direction:column; gap:16px;">
      <div class="loading-state"><div class="spinner spinner-dark"></div> Memuat data...</div>
    </div>
  `;

  // Inisialisasi Kalender (Single Date)
  const today = new Date().toISOString().split('T')[0];
  const fp = flatpickr("#filter-tanggal-harian", {
    dateFormat: "Y-m-d",
    defaultDate: today,
    maxDate: "today",
    onChange: function() {
      loadHarianData();
    }
  });

  // Ambil semua daftar ruangan (kecuali ADMIN)
  const { data: listRuangan } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');

  // Fungsi Load Data
  async function loadHarianData() {
    const selectedDate = fp.selectedDates[0] ? fp.selectedDates[0].toISOString().split('T')[0] : today;
    const grid = document.getElementById('harian-grid');
    
    grid.innerHTML = `<div class="loading-state"><div class="spinner spinner-dark"></div> Memuat data...</div>`;

    // Query Laporan di tanggal tersebut
    const { data: laporanHarian, error } = await supabase.from('laporan')
      .select('ruangan_id, shift, petugas_ids, data')
      .eq('tanggal', selectedDate);

    if (error) {
      grid.innerHTML = `<div class="login-error">Gagal memuat: ${error.message}</div>`;
      return;
    }

    // Ambil master staff untuk mapping nama
    const { data: staffList } = await supabase.from('staff').select('id, nama');
    const staffMap = {};
    if (staffList) staffList.forEach(s => staffMap[s.id] = s.nama);

    grid.innerHTML = ''; // Bersihkan loading

    if (laporanHarian.length === 0) {
      grid.innerHTML = `<div style="background:#fff; padding:20px; border-radius:8px; text-align:center; color:var(--gray-500);">Tidak ada laporan pada tanggal ${selectedDate}.</div>`;
      return;
    }

    // Loop setiap ruangan untuk menampilkan kartu ringkasan
    listRuangan.forEach(r => {
      // Saring laporan khusus ruangan ini
      const lapRuangan = laporanHarian.filter(l => l.ruangan_id === r.id);
      if (lapRuangan.length === 0) return; // Lewati jika ruangan tidak ada laporan

      // Kumpulkan nama staff dari petugas_ids
      const semuaPetugas = [];
      lapRuangan.forEach(lap => {
        if (lap.petugas_ids && lap.petugas_ids.length > 0) {
          lap.petugas_ids.forEach(id => {
            const nama = staffMap[id];
            if (nama && !semuaPetugas.includes(nama)) semuaPetugas.push(nama);
          });
        }
      });

      / Siapkan ringkasan angka (Gunakan DEFAULT_METRICS)
      const template = getTemplate(r.template_key);
      
      // Ambil metricId dari konfigurasi default, atau field metric pertama
      const metricId = DEFAULT_METRICS[r.template_key] || template.fields.find(f => f.metric)?.id;
      const metricLabel = template.fields.find(f => f.id === metricId)?.label || 'Data';

      let totalAngka = 0;
      lapRuangan.forEach(lap => {
        if (metricId) {
          let val = lap.data[metricId];
          // Jika tidak ketemu, coba tanpa 'jumlah_'
          if (val === undefined && metricId.startsWith('jumlah_')) {
             val = lap.data[metricId.replace('jumlah_', '')];
          }
          totalAngka += (parseInt(val) || 0);
        }
      });

      // Siapkan HTML Shift (jika ada)
      let shiftHTML = '';
      const shifts = lapRuangan.map(l => l.shift).filter(Boolean);
      if (shifts.length > 0) {
        shiftHTML = `<div style="font-size:0.8rem; color:var(--gray-500); margin-top:4px;">Shift: ${shifts.join(', ').toUpperCase()}</div>`;
      }

      // Render Kartu
      grid.innerHTML += `
        <div style="background:#fff; border-radius:12px; border:1px solid var(--gray-200); overflow:hidden; box-shadow:var(--shadow-sm);">
          <div style="background:var(--green-50); padding:12px 16px; border-bottom:1px solid var(--green-100); display:flex; justify-content:space-between; align-items:center;">
            <h4 style="margin:0; color:var(--green-800);">${r.nama}</h4>
            <span class="badge" style="background:var(--green-600); color:#fff;">${lapRuangan.length} Shift</span>
          </div>
          <div style="padding:16px;">
            <p style="margin:0 0 8px; font-size:0.9rem;">
              <strong>${labelUtama}:</strong> <span style="font-size:1.1rem; font-weight:bold; color:var(--green-700);">${totalAngka}</span>
            </p>
            ${shiftHTML}
            <p style="margin:8px 0 0; font-size:0.85rem; color:var(--gray-700);">
              <strong>Petugas:</strong> ${semuaPetugas.length > 0 ? semuaPetugas.join(', ') : '<i style="color:var(--gray-500);">Tidak ada nama petugas</i>'}
            </p>
          </div>
        </div>
      `;
    });

    // Simpan data untuk export
    container.dataset.rawData = JSON.stringify(laporanHarian);
  }

  // Event Export Excel
  document.getElementById('btn-export-excel-harian').addEventListener('click', () => {
    const selectedDate = fp.selectedDates[0] ? fp.selectedDates[0].toISOString().split('T')[0] : today;
    exportHarianData(container, 'excel', selectedDate, listRuangan);
  });

  // Event Export PDF
  document.getElementById('btn-export-pdf-harian').addEventListener('click', () => {
    const selectedDate = fp.selectedDates[0] ? fp.selectedDates[0].toISOString().split('T')[0] : today;
    exportHarianData(container, 'pdf', selectedDate, listRuangan);
  });

  // Panggil pertama kali
  await loadHarianData();
}

// Fungsi Export (Sederhana)
function exportHarianData(container, type, selectedDate, listRuangan) {
  if (!container.dataset.rawData) return alert("Tidak ada data.");
  const data = JSON.parse(container.dataset.rawData);
  if (data.length === 0) return alert("Data kosong di tanggal ini.");

  // Ambil master staff
  // (Karena export ini butuh mapping nama, kita ambil ulang via fetch atau biarkan sederhana)
  // Untuk mempermudah, kita buat script export text sederhana:
  
  let content = `Laporan Harian Terpadu - ${selectedDate}\n\n`;
  
  listRuangan.forEach(r => {
    const lapRuangan = data.filter(l => l.ruangan_id === r.id);
    if (lapRuangan.length === 0) return;
    
    content += `RUANGAN: ${r.nama}\n`;
    content += `Jumlah Shift: ${lapRuangan.length}\n`;
    
    // Ambil semua data JSON dan tampilkan
    lapRuangan.forEach(lap => {
       content += ` - Shift: ${lap.shift || '-'}\n`;
       content += `   Data: ${JSON.stringify(lap.data)}\n`;
    });
    content += `\n`;
  });

  if (type === 'excel') {
    // Download as text (bisa dibuka di Excel)
    const blob = new Blob([content], { type: 'text/plain' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Laporan_Harian_${selectedDate}.txt`;
    a.click();
  } else {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.setFontSize(12);
    doc.text(`Laporan Harian Terpadu - ${selectedDate}`, 14, 15);
    
    const splitText = doc.splitTextToSize(content, 180);
    doc.text(splitText, 14, 25);
    
    doc.save(`Laporan_Harian_${selectedDate}.pdf`);
  }
}
