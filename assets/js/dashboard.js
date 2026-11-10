// assets/js/dashboard.js
import { supabase } from './supabase.js';
import { getTemplate, getMetricFields } from './templates.js';

let myChart = null; // Menyimpan instance Chart.js

export async function renderDashboard(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  // Ambil daftar ruangan jika admin
  let listRuangan = [];
  if (isAdmin) {
    const { data } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');
    listRuangan = data || [];
  }

  const defaultTemplateKey = isAdmin ? (listRuangan[0]?.template_key || 'igd') : state.ruangan.template_key;

  // Render Dropdown Ruangan khusus Admin
  let adminFilterHTML = '';
  if (isAdmin) {
    const opts = listRuangan.map(r => `<option value="${r.template_key}">${r.nama}</option>`).join('');
    adminFilterHTML = `
      <div class="form-group" style="margin:0;">
        <label style="font-size:.75rem;">Pilih Ruangan</label>
        <select id="admin-filter-ruangan" class="form-control">
          ${opts}
        </select>
      </div>
    `;
  }

  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Dashboard Pelayanan</h2>
      <div class="filter-bar">
        ${adminFilterHTML}
        <div class="form-group" style="margin:0;">
          <label style="font-size:.75rem;">Rentang Waktu</label>
          <select id="filter-range" class="form-control">
            <option value="7">7 Hari Terakhir</option>
            <option value="30">30 Hari Terakhir</option>
            <option value="month">Bulan Ini</option>
            <option value="year">Tahun Ini</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label style="font-size:.75rem;">Data Grafik</label>
          <select id="filter-metric" class="form-control"></select>
        </div>
        <div class="action-buttons">
          <button id="btn-export-excel" class="btn-secondary">📊 Excel</button>
          <button id="btn-export-pdf" class="btn-secondary">📄 PDF</button>
        </div>
      </div>
    </div>

    <div class="kpi-grid" id="kpi-container"></div>
    <div class="chart-card"><div class="chart-wrapper"><canvas id="mainChart"></canvas></div></div>
    <div class="table-card">
      <h3 class="section-title">Riwayat Laporan</h3>
      <div class="table-responsive">
        <table class="data-table" id="table-history">
          <thead><tr><th>Tanggal</th><th>Shift</th><th>Petugas</th><th>Data Angka</th></tr></thead>
          <tbody id="tbody-history"></tbody>
        </table>
      </div>
    </div>
  `;

  // Fungsi memuat data berdasarkan dropdown yang dipilih
  const currentLoadData = async (tKey) => {
    const template = getTemplate(tKey);
    const rId = isAdmin ? listRuangan.find(ru => ru.template_key === tKey)?.id : state.profile.ruangan_id;
    
    // Update pilihan metrik
    document.getElementById('filter-metric').innerHTML = getMetricFields(tKey).map(m => `<option value="${m.id}">${m.label}</option>`).join('');
    
    await muatData(container, rId, tKey, template);
  };

  // Event Listener Filter
  document.getElementById('filter-range').addEventListener('change', () => {
    const t = isAdmin ? document.getElementById('admin-filter-ruangan').value : defaultTemplateKey;
    currentLoadData(t);
  });
  document.getElementById('filter-metric').addEventListener('change', () => {
    const t = isAdmin ? document.getElementById('admin-filter-ruangan').value : defaultTemplateKey;
    currentLoadData(t);
  });
  if (isAdmin) {
    document.getElementById('admin-filter-ruangan').addEventListener('change', (e) => currentLoadData(e.target.value));
  }

  // Event Listener Export (Gunakan data terakhir yang dimuat)
  document.getElementById('btn-export-excel').addEventListener('click', () => {
    const t = isAdmin ? document.getElementById('admin-filter-ruangan').value : defaultTemplateKey;
    exportExcel(t, getTemplate(t), container.dataset.rawData);
  });
  document.getElementById('btn-export-pdf').addEventListener('click', () => {
    const t = isAdmin ? document.getElementById('admin-filter-ruangan').value : defaultTemplateKey;
    exportPDF(t, getTemplate(t), container.dataset.rawData);
  });

  await currentLoadData(defaultTemplateKey);
}

/* =========================================================
   LOGIKA PENGAMBILAN DATA
   ========================================================= */
async function muatData(container, rId, templateKey, template) {
  const range = document.getElementById('filter-range').value;
  const metricId = document.getElementById('filter-metric').value;

  // 1. Hitung Tanggal Mulai
  const now = new Date();
  let startDate = new Date();
  if (range === '7') startDate.setDate(now.getDate() - 7);
  else if (range === '30') startDate.setDate(now.getDate() - 30);
  else if (range === 'month') startDate = new Date(now.getFullYear(), now.getMonth(), 1);
  else if (range === 'year') startDate = new Date(now.getFullYear(), 0, 1);
  
  const startStr = startDate.toISOString().split('T')[0];

  // 2. Query ke Supabase
  let query = supabase
    .from('laporan')
    .select(`
      id, tanggal, shift, data, petugas_ids,
      staff_array:petugas_ids ( nama ) 
    `)
    .eq('ruangan_id', rId) // Filter berdasarkan ID Ruangan
    .gte('tanggal', startStr)
    .order('tanggal', { ascending: true });

  const { data, error } = await query;

  if (error) {
    console.error(error);
    document.getElementById('tbody-history').innerHTML = `<tr><td colspan="4" class="login-error">Gagal memuat: ${error.message}</td></tr>`;
    return;
  }

  // Simpan data mentah ke DOM untuk keperluan Export
  container.dataset.rawData = JSON.stringify(data);

  // 3. Olah Data untuk Grafik & KPI
  const labels = data.map(d => d.tanggal);
  const values = data.map(d => {
    const val = d.data[metricId];
    return typeof val === 'number' ? val : 0;
  });

  // Hitung KPI
  let totalPetugas = new Set();
  let totalMetric = 0;
  
  data.forEach(d => {
    totalMetric += (d.data[metricId] || 0);
    if (d.petugas_ids) d.petugas_ids.forEach(id => totalPetugas.add(id));
  });

  const metricLabel = template.fields.find(f=>f.id===metricId)?.label || 'Data';
  renderKPI(totalMetric, data.length, totalPetugas.size, metricLabel);
  renderChart(labels, values, metricLabel);
  renderTable(data, template);
}

/* =========================================================
   RENDER KOMPONEN (KPI, CHART, TABLE)
   ========================================================= */
function renderKPI(totalMetric, totalLaporan, totalPetugas, metricLabel) {
  document.getElementById('kpi-container').innerHTML = `
    <div class="kpi-card">
      <div class="kpi-icon">📈</div>
      <div class="kpi-data">
        <span class="kpi-label">Total ${metricLabel}</span>
        <h3 class="kpi-value">${totalMetric.toLocaleString('id-ID')}</h3>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">📝</div>
      <div class="kpi-data">
        <span class="kpi-label">Laporan Masuk</span>
        <h3 class="kpi-value">${totalLaporan}</h3>
      </div>
    </div>
    <div class="kpi-card">
      <div class="kpi-icon">👥</div>
      <div class="kpi-data">
        <span class="kpi-label">Petugas Aktif</span>
        <h3 class="kpi-value">${totalPetugas}</h3>
      </div>
    </div>
  `;
}

function renderChart(labels, values, label) {
  const ctx = document.getElementById('mainChart').getContext('2d');
  
  if (myChart) myChart.destroy(); // Hapus chart lama jika ada

  // Format tanggal ke dd MMM
  const formatLabels = labels.map(l => {
    const d = new Date(l);
    return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
  });

  myChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: formatLabels,
      datasets: [{
        label: label,
        data: values,
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.1)',
        borderWidth: 3,
        pointBackgroundColor: '#16a34a',
        pointBorderColor: '#fff',
        pointRadius: 4,
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
        x: { grid: { display: false } }
      }
    }
  });
}

function renderTable(data, template) {
  const tbody = document.getElementById('tbody-history');
  if (data.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Belum ada data di rentang waktu ini.</td></tr>`;
    return;
  }

  // Urutkan terbalik (terbaru di atas)
  const sortedData = [...data].reverse();

  tbody.innerHTML = sortedData.map(d => {
    let namaPetugas = (d.staff_array || []).map(s => s.nama.split(',')[0]).join(', ');
    if (!namaPetugas) namaPetugas = '-';

    // Ambil semua isi data angka, buang tanggal & shift
    let detailAngka = template.fields
      .filter(f => f.type === 'number')
      .map(f => `${f.label}: <b>${d.data[f.id] || 0}</b>`)
      .join('<br>');

    return `
      <tr>
        <td style="white-space:nowrap;">${new Date(d.tanggal).toLocaleDateString('id-ID')}</td>
        <td>${d.shift ? d.shift.toUpperCase() : '-'}</td>
        <td>${namaPetugas}</td>
        <td style="font-size: .8rem; line-height: 1.4;">${detailAngka}</td>
      </tr>
    `;
  }).join('');
}

/* =========================================================
   EXPORT EXCEL & PDF
   ========================================================= */
function exportExcel(templateKey, template, rawDataStr) {
  if (!rawDataStr) return alert("Tidak ada data untuk di-export.");
  const data = JSON.parse(rawDataStr);
  if (data.length === 0) return alert("Tidak ada data untuk di-export.");

  const headers = ['Tanggal', 'Shift', 'Petugas'];
  template.fields.filter(f => f.type === 'number').forEach(f => headers.push(f.label));

  const rows = data.map(d => {
    const row = [d.tanggal, d.shift || '-', (d.staff_array || []).map(s => s.nama).join(', ')];
    template.fields.filter(f => f.type === 'number').forEach(f => row.push(d.data[f.id] || 0));
    return row;
  });

  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Laporan");
  XLSX.writeFile(wb, `Laporan_${templateKey}_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function exportPDF(templateKey, template, rawDataStr) {
  if (!rawDataStr) return alert("Tidak ada data untuk di-export.");
  const data = JSON.parse(rawDataStr);
  if (data.length === 0) return alert("Tidak ada data untuk di-export.");

  const { jsPDF } = window.jspdf;
  const doc = new jsPDF('landscape');

  doc.setFontSize(16);
  doc.text(`Laporan Harian - ${template.nama}`, 14, 15);
  doc.setFontSize(10);
  doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

  const headers = [['Tanggal', 'Shift', 'Petugas']];
  template.fields.filter(f => f.type === 'number').forEach(f => headers[0].push(f.label));

  const body = data.map(d => {
    const row = [
      new Date(d.tanggal).toLocaleDateString('id-ID'),
      d.shift || '-',
      (d.staff_array || []).map(s => s.nama).join(', ')
    ];
    template.fields.filter(f => f.type === 'number').forEach(f => row.push(d.data[f.id] || 0));
    return row;
  });

  doc.autoTable({
    head: headers,
    body: body,
    startY: 28,
    styles: { fontSize: 8 },
    headStyles: { fillColor: [22, 163, 74] }
  });

  doc.save(`Laporan_${templateKey}_${new Date().toISOString().split('T')[0]}.pdf`);
}
