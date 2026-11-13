// assets/js/laporan_harian.js
import { supabase } from './supabase.js';
import { getTemplate } from './templates.js';

// KONFIGURASI SAMA PERSIS DENGAN DASHBOARD.JS
const DEFAULT_METRICS = {
  'ibs': 'operasi_elektif',
  'igd': 'resep_terlayani',
  'irin_mat': 'resep_per_shift', 
  'irna1': 'resep_per_shift', // <-- UBAH
  'onkologi': 'jumlah_sediaan_iv_admixture_sitostatika',
  'rj': 'total_resep',
  'rj_maternitas': 'total_resep'
};

export async function renderLaporanHarian(container, state) {
  // Tampilan Filter (Hanya Tanggal)
  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Laporan Harian Terpadu</h2>
      <p style="color:var(--gray-500); margin-bottom:16px;">Melihat semua pelayanan di setiap ruangan pada tanggal tertentu. <i>Klik kartu ruangan untuk melihat detail.</i></p>
      
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

    <!-- Modal Detail Ruangan -->
    <dialog id="modal-detail-harian" class="modal-petugas" style="max-width: 800px;">
      <div class="modal-header">
        <h3 id="modal-detail-title" style="margin:0; color:var(--green-800);">Detail Pelayanan</h3>
        <button id="btn-close-modal-harian" class="modal-close">×</button>
      </div>
      <div class="modal-body-grid" id="modal-detail-content" style="display:block; padding: 20px;">
        <!-- Konten Detail Shift -->
      </div>
    </dialog>
  `;

  // Inisialisasi Kalender
  const today = new Date().toISOString().split('T')[0];
  const fp = flatpickr("#filter-tanggal-harian", {
    dateFormat: "Y-m-d",
    defaultDate: today,
    maxDate: "today",
    onChange: function() {
      loadHarianData();
    }
  });

  const { data: listRuangan } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');

  // Fungsi Load Data
  async function loadHarianData() {
    const selectedDate = fp.selectedDates[0] ? fp.selectedDates[0].toISOString().split('T')[0] : today;
    const grid = document.getElementById('harian-grid');
    
    grid.innerHTML = `<div class="loading-state"><div class="spinner spinner-dark"></div> Memuat data...</div>`;

    const { data: laporanHarian, error } = await supabase.from('laporan')
      .select('ruangan_id, shift, petugas_ids, data')
      .eq('tanggal', selectedDate);

    if (error) {
      grid.innerHTML = `<div class="login-error">Gagal memuat: ${error.message}</div>`;
      return;
    }

    const { data: staffList } = await supabase.from('staff').select('id, nama');
    const staffMap = {};
    if (staffList) staffList.forEach(s => staffMap[s.id] = s.nama);

    grid.innerHTML = ''; 

    if (laporanHarian.length === 0) {
      grid.innerHTML = `<div style="background:#fff; padding:20px; border-radius:8px; text-align:center; color:var(--gray-500);">Tidak ada laporan pada tanggal ${selectedDate}.</div>`;
      return;
    }

    // Simpan data ke global window untuk diakses modal
    window.dataHarianGlobal = laporanHarian;
    window.staffMapGlobal = staffMap;

    // Loop setiap ruangan
    listRuangan.forEach(r => {
      const lapRuangan = laporanHarian.filter(l => l.ruangan_id === r.id);
      if (lapRuangan.length === 0) return;

      const semuaPetugas = [];
      lapRuangan.forEach(lap => {
        if (lap.petugas_ids && lap.petugas_ids.length > 0) {
          lap.petugas_ids.forEach(id => {
            const nama = staffMap[id];
            if (nama && !semuaPetugas.includes(nama)) semuaPetugas.push(nama);
          });
        }
      });

      const template = getTemplate(r.template_key);
      const metricId = DEFAULT_METRICS[r.template_key] || template.fields.find(f => f.metric)?.id;
      const metricLabel = template.fields.find(f => f.id === metricId)?.label || 'Data';

      let totalAngka = 0;
      lapRuangan.forEach(lap => {
        if (metricId) {
          let val = lap.data[metricId];
          if (val === undefined && metricId.startsWith('jumlah_')) {
             val = lap.data[metricId.replace('jumlah_', '')];
          }
          totalAngka += (parseInt(val) || 0);
        }
      });

      let shiftHTML = '';
      const shifts = lapRuangan.map(l => l.shift).filter(Boolean);
      if (shifts.length > 0) {
        shiftHTML = `<div style="font-size:0.8rem; color:var(--gray-500); margin-top:4px;">Shift: ${shifts.join(', ').toUpperCase()}</div>`;
      }

      // KARTU RUANGAN (KLIK UNTUK DETAIL)
      grid.innerHTML += `
        <div style="background:#fff; border-radius:12px; border:1px solid var(--gray-200); overflow:hidden; box-shadow:var(--shadow-sm); cursor:pointer; transition: transform 0.1s;" 
             onclick="bukaDetailHarian('${r.id}', '${r.nama.replace(/'/g, "\\'")}', '${r.template_key}')"
             onmouseover="this.style.transform='scale(1.01)'" 
             onmouseout="this.style.transform='scale(1)'">
          <div style="background:var(--green-50); padding:12px 16px; border-bottom:1px solid var(--green-100); display:flex; justify-content:space-between; align-items:center;">
            <h4 style="margin:0; color:var(--green-800);">${r.nama}</h4>
            <span class="badge" style="background:var(--green-600); color:#fff;">${lapRuangan.length} Shift</span>
          </div>
          <div style="padding:16px;">
            <p style="margin:0 0 8px; font-size:0.9rem;">
              <strong>${metricLabel}:</strong> <span style="font-size:1.1rem; font-weight:bold; color:var(--green-700);">${totalAngka}</span>
            </p>
            ${shiftHTML}
            <p style="margin:8px 0 0; font-size:0.85rem; color:var(--gray-700);">
              <strong>Petugas:</strong> ${semuaPetugas.length > 0 ? semuaPetugas.join(', ') : '<i style="color:var(--gray-500);">Tidak ada nama petugas</i>'}
            </p>
          </div>
        </div>
      `;
    });

    container.dataset.rawData = JSON.stringify(laporanHarian);
  }

  // FUNGSI BUKA MODAL DETAIL
  window.bukaDetailHarian = (ruanganId, ruanganNama, templateKey) => {
    const dialog = document.getElementById('modal-detail-harian');
    const title = document.getElementById('modal-detail-title');
    const content = document.getElementById('modal-detail-content');
    
    title.textContent = `Detail: ${ruanganNama}`;
    
    // Filter data ruangan ini dari global
    const lapRuangan = window.dataHarianGlobal.filter(l => l.ruangan_id === ruanganId);
    const template = getTemplate(templateKey);

    // Dapatkan semua field angka (metric) dari template
    const numFields = template.fields.filter(f => f.type === 'number' && f.metric);

    let html = '';

    // Urutkan berdasarkan shift (Pagi, Siang, Malam/Middle/Sore)
    const shiftOrder = { 'pagi': 1, 'siang': 2, 'middle': 2, 'sore': 3, 'malam': 3 };
    lapRuangan.sort((a, b) => {
      const sA = shiftOrder[a.shift] || 99;
      const sB = shiftOrder[b.shift] || 99;
      return sA - sB;
    });

    lapRuangan.forEach((lap, index) => {
      // Header Shift
      html += `
        <div style="background:var(--green-100); padding:8px 12px; border-radius:6px; margin-bottom:12px; margin-top:16px; font-weight:bold; color:var(--green-800); text-transform:uppercase;">
          SHIFT: ${lap.shift || '-'}
        </div>
      `;

      // Daftar Angka Pelayanan
      html += `<table style="width:100%; border-collapse:collapse; font-size:0.9rem;">`;
      numFields.forEach(f => {
        let val = lap.data[f.id];
        if (val === undefined) val = lap.data[`jumlah_${f.id}`] || 0;
        
        html += `
          <tr style="border-bottom:1px solid var(--gray-100);">
            <td style="padding:6px 0; color:var(--gray-700);">${f.label}</td>
            <td style="padding:6px 0; text-align:right; font-weight:bold; color:var(--green-800);">${val}</td>
          </tr>
        `;
      });
      html += `</table>`;

      // Daftar Petugas
      const petugasNames = (lap.petugas_ids || []).map(id => window.staffMapGlobal[id]).filter(Boolean);
      if (petugasNames.length > 0) {
        html += `<div style="margin-top:8px; font-size:0.85rem; color:var(--gray-500);"><strong>Petugas:</strong> ${petugasNames.join(', ')}</div>`;
      }
    });

    content.innerHTML = html;
    dialog.showModal();
  };

  // Event Tutup Modal
  document.getElementById('btn-close-modal-harian').addEventListener('click', () => {
    document.getElementById('modal-detail-harian').close();
  });

  // Event Export
  document.getElementById('btn-export-excel-harian').addEventListener('click', () => {
    const selectedDate = fp.selectedDates[0] ? fp.selectedDates[0].toISOString().split('T')[0] : today;
    exportHarianData(container, 'excel', selectedDate, listRuangan);
  });

  document.getElementById('btn-export-pdf-harian').addEventListener('click', () => {
    const selectedDate = fp.selectedDates[0] ? fp.selectedDates[0].toISOString().split('T')[0] : today;
    exportHarianData(container, 'pdf', selectedDate, listRuangan);
  });

  // Panggil pertama kali
  await loadHarianData();
}

// Fungsi Export Sederhana (Sama seperti sebelumnya)
function exportHarianData(container, type, selectedDate, listRuangan) {
  if (!container.dataset.rawData) return alert("Tidak ada data.");
  const data = JSON.parse(container.dataset.rawData);
  if (data.length === 0) return alert("Data kosong di tanggal ini.");
  
  let content = `Laporan Harian Terpadu - ${selectedDate}\n\n`;
  
  listRuangan.forEach(r => {
    const lapRuangan = data.filter(l => l.ruangan_id === r.id);
    if (lapRuangan.length === 0) return;
    
    content += `RUANGAN: ${r.nama}\n`;
    content += `Jumlah Shift: ${lapRuangan.length}\n`;
    
    lapRuangan.forEach(lap => {
       content += ` - Shift: ${lap.shift || '-'}\n`;
       content += `   Data: ${JSON.stringify(lap.data)}\n`;
    });
    content += `\n`;
  });

  if (type === 'excel') {
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
