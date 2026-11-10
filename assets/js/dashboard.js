// assets/js/dashboard.js
import { supabase } from './supabase.js';
import { getTemplate, getMetricFields } from './templates.js';

let myChart = null;

// =========================================================
// KONFIGURASI DEFAULT METRIK PER RUANGAN (Sesuai Permintaan)
// =========================================================
const DEFAULT_METRICS = {
  'ibs': 'operasi_elektif',
  'igd': 'resep_terlayani',
  'irin_mat': 'resep_per_shift',
  'irna1': 'resep_per_shift',
  'onkologi': 'sediaan_sitostatika', 
  'rj': 'total_resep',
  'rj_maternitas': 'total_resep'
};

export async function renderDashboard(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  // Ambil daftar ruangan
  const { data: listRuangan } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');

  // HTML Tampilan Dashboard
  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Dashboard Pelayanan</h2>
      
      <div class="filter-bar" style="align-items:flex-end; display:flex; flex-wrap:wrap; gap:12px; background:#fff; padding:16px; border-radius:12px; border:1px solid var(--gray-200); margin-bottom:24px;">
        
        <div class="form-group" style="margin:0; flex:1; min-width:150px;">
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

    <dialog id="modal-chart" style="width:90vw; max-width:1200px; padding:20px; border-radius:12px; border:none; box-shadow:0 10px 40px rgba(0,0,0,.2);">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px;">
        <h3 id="modal-title" style="margin:0; color:var(--green-800);">Detail Grafik</h3>
        <button id="btn-close-modal" style="background:none; border:none; font-size:24px; cursor:pointer; color:var(--gray-500);">×</button>
      </div>
      <div style="position:relative; height:70vh; width:100%;">
        <canvas id="popupChart"></canvas>
      </div>
    </dialog>
  `;

  // Inisialisasi Kalender
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

  // Event Listener Tahun
  document.getElementById('filter-tahun').addEventListener('change', (e) => {
    const year = parseInt(e.target.value);
    fp.setDate([`${year}-01-01`, `${year}-12-31`]);
    loadAllData();
  });

  // Event Tutup Modal
  document.getElementById('btn-close-modal').addEventListener('click', () => {
    document.getElementById('modal-chart').close();
  });

  // Fungsi Load Data
  async function loadAllData() {
    const dates = fp.selectedDates;
    if (dates.length !== 2) return;
    
    const startDate = dates[0].toISOString().split('T')[0];
    const endDate = dates[1].toISOString().split('T')[0];
    const grid = document.getElementById('charts-grid');
    
    grid.innerHTML = `<div class="loading-state" style="grid-column:1/-1;"><div class="spinner spinner-dark"></div> Memuat grafik...</div>`;

    // Query dasar
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

    let ruanganToDraw = isAdmin ? listRuangan : [state.ruangan];

    ruanganToDraw.forEach((r, index) => {
      // Tentukan metrik default untuk ruangan ini
      const metricId = DEFAULT_METRICS[r.template_key] || getMetricFields(r.template_key)[0]?.id;
      const metricLabel = getMetricFields(r.template_key).find(m => m.id === metricId)?.label || 'Data';
      
      // Saring data khusus ruangan ini
      const dataRuangan = data.filter(d => d.ruangan_id === r.id);
      
      // Buat Canvas Box
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

      // Siapkan data Grafik
      const labels = [...new Set(dataRuangan.map(d => d.tanggal))].sort();
      const values = labels.map(tgl => {
        const lap = dataRuangan.find(d => d.tanggal === tgl);
        return lap ? (lap.data[metricId] || 0) : 0;
      });

      // Format label tanggal
      const diffDays = (dates[1] - dates[0]) / (1000 * 60 * 60 * 24);
      const formattedLabels = labels.map(l => {
        const d = new Date(l);
        if (diffDays > 90) return d.toLocaleDateString('id-ID', { month: 'short', year: 'numeric' });
        return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
      });

      // Gambar Mini Chart
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
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: { 
              y: { beginAtZero: true, ticks:{font:{size:10}} }, 
              x: { ticks:{font:{size:10}} } 
            }
          }
        });
      }, 100 * index);
    });
    
    container.dataset.rawData = JSON.stringify(data);
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
        const labels = data.map(d => d.tanggal);
        const values = data.map(d => d.data[metricId] || 0);
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
            responsive: true, maintainAspectRatio: false,
            plugins: { legend: { display: true, position: 'top' } },
            scales: { y: { beginAtZero: true } }
          }
        });
      });
  };

  await loadAllData();
}
