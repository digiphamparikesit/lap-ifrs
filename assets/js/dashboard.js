// assets/js/dashboard.js
import { supabase } from './supabase.js';
import { getTemplate, getMetricFields } from './templates.js';

let myChart = null;

// =========================================================
// KONFIGURASI METRIK TETAP PER RUANGAN (Terkunci)
// =========================================================
const DEFAULT_METRICS = {
  'ibs': 'operasi_elektif',
  'igd': 'resep_terlayani',
  'irin_mat': 'resep_per_shift', 
  'irna1': 'resep_per_shift',
  'onkologi': 'jumlah_sediaan_iv_admixture_sitostatika',
  'rj': 'total_resep',
  'rj_maternitas': 'total_resep'
};

export async function renderDashboard(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  const { data: listRuangan } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');

  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Dashboard Pelayanan</h2>
      
      <div class="filter-bar" style="align-items:flex-end; display:flex; flex-wrap:wrap; gap:12px; background:#fff; padding:16px; border-radius:12px; border:1px solid var(--gray-200); margin-bottom:24px;">
        
        <div class="form-group" style="margin:0; flex:1; min-width:120px;">
          <label style="font-size:.75rem;">Tahun</label>
          <select id="filter-tahun" class="form-control">
            <option value="2026">2026</option>
            <option value="2025">2025</option>
            <option value="2024">2024</option>
            <option value="2023">2023</option>
          </select>
        </div>

        <div class="form-group" style="margin:0; flex:2; min-width:250px;">
          <label style="font-size:.75rem;">Rentang Tanggal</label>
          <input type="text" id="filter-tanggal" class="form-control" placeholder="Pilih rentang..." readonly>
        </div>
        
        <div style="display:flex; gap:8px;">
          <button id="btn-export-excel" class="btn-secondary" style="padding: 8px 12px;">📊 Excel</button>
          <button id="btn-export-pdf" class="btn-secondary" style="padding: 8px 12px;">📄 PDF</button>
        </div>
      </div>
    </div>

    <div id="charts-grid" style="display:grid; grid-template-columns: repeat(auto-fit, minmax(400px, 1fr)); gap:20px;"></div>

    <!-- Modal Pop-up Grafik Full Screen -->
    <dialog id="modal-chart" style="width:90vw; max-width:1200px; padding:20px; border-radius:12px; border:none; box-shadow:0 10px 40px rgba(0,0,0,.2); margin:auto; position:fixed; inset:0; z-index:9999;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 id="modal-title" style="margin:0; color:var(--green-800);">Detail Grafik</h3>
        <button id="btn-close-modal" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--gray-500);">×</button>
      </div>
      <div style="position:relative; height:70vh; width:100%;">
        <canvas id="popupChart"></canvas>
      </div>
    </dialog>
  `;

  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const fp = flatpickr("#filter-tanggal", {
    mode: "range",
    dateFormat: "Y-m-d",
    defaultDate: [startOfYear, today],
    onChange: function(selectedDates) {
      if (selectedDates.length === 2) loadAllData();
    }
  });

  document.getElementById('filter-tahun').addEventListener('change', (e) => {
    const year = parseInt(e.target.value);
    fp.setDate([`${year}-01-01`, `${year}-12-31`]);
    loadAllData();
  });

  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('modal-chart').close();
  });

  let dataTerakhir = [];

  async function loadAllData() {
    const dates = fp.selectedDates;
    if (dates.length !== 2) return;
    
    const startDate = dates[0].toISOString().split('T')[0];
    const endDate = dates[1].toISOString().split('T')[0];
    const grid = document.getElementById('charts-grid');
    
    grid.innerHTML = `<div class="loading-state" style="grid-column:1/-1;"><div class="spinner spinner-dark"></div> Memuat grafik...</div>`;

    let query = supabase.from('laporan')
      .select('ruangan_id, tanggal, data')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true });

    if (!isAdmin) query = query.eq('ruangan_id', state.profile.ruangan_id);

    const { data, error } = await query;

    if (error) {
      grid.innerHTML = `<div class="login-error">Gagal memuat data: ${error.message}</div>`;
      return;
    }

    grid.innerHTML = '';
    dataTerakhir = data;
    // ==========================================
    // KODE DEBUGGING SEMENTARA
    // ==========================================
    const dataNov = data.filter(d => d.tanggal === '2026-11-12');
    console.log("=== DATA TANGGAL 12 NOVEMBER ===");
    console.log(JSON.stringify(dataNov, null, 2));
    // ==========================================

    let ruanganToDraw = isAdmin ? listRuangan : [state.ruangan];

    ruanganToDraw.forEach((r, index) => {
      const dataRuangan = data.filter(d => d.ruangan_id === r.id);

      let metricId = DEFAULT_METRICS[r.template_key] || getMetricFields(r.template_key)[0]?.id;
      let metricLabel = getMetricFields(r.template_key).find(m => m.id === metricId)?.label || 'Data';

      // Penerjemah otomatis jika format ID beda
      if (dataRuangan.length > 0 && dataRuangan[0].data[metricId] === undefined) {
         if (dataRuangan[0].data[`jumlah_${metricId}`] !== undefined) {
             metricId = `jumlah_${metricId}`;
         } else if (metricId.startsWith('jumlah_') && dataRuangan[0].data[metricId.replace('jumlah_', '')] !== undefined) {
             metricId = metricId.replace('jumlah_', '');
         }
      }
            
      const boxId = `chart-box-${r.id}`;
      grid.innerHTML += `
        <div class="chart-card" style="cursor:pointer;" onclick="openFullScreen('${r.id}', '${r.nama.replace(/'/g, "\\'")}', '${metricId}', '${startDate}', '${endDate}', '${metricLabel}')">
          <h4 style="margin-top:0; color:var(--green-800);">${r.nama}</h4>
          <p style="font-size:0.8rem; color:var(--gray-500); margin-bottom:8px;">Metrik: ${metricLabel}</p>
          <div style="position:relative; height:200px;">
            <canvas id="${boxId}"></canvas>
          </div>
        </div>
      `;

      // 1. Ambil tanggal unik
      const labels = [...new Set(dataRuangan.map(d => d.tanggal))].sort();
      
      // 2. Hitung total per tanggal
      const values = labels.map(tgl => {
        const lapsHariItu = dataRuangan.filter(d => d.tanggal === tgl);
        let totalHarian = 0;
        lapsHariItu.forEach(lap => {
          let val = lap.data[metricId];
          if (val === undefined) val = lap.data[`jumlah_${metricId}`];
          totalHarian += (parseInt(val) || 0);
        });
        return totalHarian;
      });

      const diffDays = (dates[1] - dates[0]) / (1000 * 60 * 60 * 24);
      const formattedLabels = labels.map(l => {
        const d = new Date(l);
        if (diffDays > 90) return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      });

      // Render Grafik Kecil (Dashboard)
      setTimeout(() => {
        const ctx = document.getElementById(boxId).getContext('2d');
        new Chart(ctx, {
          type: 'line',
          data: {
            labels: formattedLabels,
            datasets: [{
              label: metricLabel,
              data: values,
              borderColor: '#16a34a',
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              borderWidth: 2,
              fill: true,
              tension: 0.3,
              pointRadius: diffDays > 90 ? 0 : 2
            }]
          },
          options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
              // KUNCI PERBAIKAN: Pakai category scale agar string tanggal dibaca persis
              x: { type: 'category', ticks: { font: { size: 10 } } },
              y: { beginAtZero: true, ticks: { font: { size: 10 } } } 
            }
          }
        });
      }, 100 * index);
    }); // <-- PENUTUP FOREACH YANG TADI HILANG
  }

  // Fungsi Buka Pop-up Full Screen
  window.openFullScreen = (ruanganId, ruanganNama, metricId, startDate, endDate, metricLabel) => {
    const dialog = document.getElementById('modal-chart');
    document.getElementById('modal-title').textContent = `Grafik Detail: ${ruanganNama} (${metricLabel})`;
    dialog.showModal();

    supabase.from('laporan')
      .select('tanggal, data')
      .eq('ruangan_id', ruanganId)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true })
      .then(({ data }) => {
        
        const grouped = {};
        data.forEach(d => {
           let val = d.data[metricId];
           if (val === undefined) val = d.data[`jumlah_${metricId}`];
           grouped[d.tanggal] = (grouped[d.tanggal] || 0) + (parseInt(val) || 0);
        });

        const labels = Object.keys(grouped).sort();
        const values = labels.map(tgl => grouped[tgl]);
        const formattedLabels = labels.map(l => new Date(l).toLocaleDateString('id-ID', { day:'2-digit', month:'short'}));
        
        if (myChart) myChart.destroy();
        const ctx = document.getElementById('popupChart').getContext('2d');
        
        myChart = new Chart(ctx, {
          type: 'line',
          data: {
            labels: formattedLabels,
            datasets: [{
              label: metricLabel,
              data: values,
              borderColor: '#16a34a',
              backgroundColor: 'rgba(22, 163, 74, 0.1)',
              borderWidth: 4,
              fill: true,
              tension: 0.3,
              pointRadius: 6,
              pointHoverRadius: 8
            }]
          },
          options: {
            responsive: true, 
            maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: { 
              // KUNCI PERBAIKAN DI POP-UP
              x: { type: 'category' },
              y: { beginAtZero: true } 
            }
          }
        });
      });
  };

  // ==========================================
  // FUNGSI EXPORT DARI GRAFIK
  // ==========================================
  document.getElementById('btn-export-excel').addEventListener('click', () => {
    if (!dataTerakhir || dataTerakhir.length === 0) return alert("Tidak ada data untuk diexport.");
    
    const exportData = dataTerakhir.map(d => {
      const ruang = listRuangan.find(r => r.id === d.ruangan_id)?.nama || '-';
      return {
        'Ruangan': ruang,
        'Tanggal': d.tanggal,
        ...d.data
      };
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Grafik");
    XLSX.writeFile(wb, `Dashboard_Export_${new Date().toISOString().split('T')[0]}.xlsx`);
  });

  document.getElementById('btn-export-pdf').addEventListener('click', () => {
    if (!dataTerakhir || dataTerakhir.length === 0) return alert("Tidak ada data untuk diexport.");
    
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text("Data Dashboard Pelayanan", 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    const sample = dataTerakhir[0].data;
    const headers = ['Ruangan', 'Tanggal', ...Object.keys(sample)];
    
    const body = dataTerakhir.map(d => {
      const ruang = listRuangan.find(r => r.id === d.ruangan_id)?.nama || '-';
      const row = [ruang, d.tanggal];
      Object.values(d.data).forEach(val => row.push(val));
      return row;
    });

    doc.autoTable({
      head: [headers],
      body: body,
      startY: 28,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [22, 163, 74] }
    });

    doc.save(`Dashboard_Export_${new Date().toISOString().split('T')[0]}.pdf`);
  });

  await loadAllData();
}
