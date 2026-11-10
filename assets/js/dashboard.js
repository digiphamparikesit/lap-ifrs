// assets/js/dashboard.js
import { supabase } from './supabase.js';
import { getTemplate, getMetricFields } from './templates.js';

let myChart = null;

export async function renderDashboard(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  // 1. Ambil semua ruangan
  const { data: ruanganList } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');
  
  // 2. Ambil semua staff untuk mapping nama
  const { data: staffList } = await supabase.from('staff').select('id, nama');
  const staffMap = {};
  if (staffList) staffList.forEach(s => staffMap[s.id] = s.nama);

  // 3. Tentukan Dropdown Ruangan & Metrik berdasarkan Role
  let filterRuanganHTML = '';
  let filterMetrikHTML = '';

  if (isAdmin) {
    // Admin: Bisa pilih ruangan (atau semua) dan semua metrik dari template IGD (sebagai default)
    const opts = ruanganList.map(r => `<option value="${r.id}" data-tk="${r.template_key}">${r.nama}</option>`).join('');
    filterRuanganHTML = `
      <div class="form-group" style="margin:0; flex:1; min-width:200px;">
        <label style="font-size:.75rem;">Pilih Ruangan</label>
        <select id="filter-ruangan" class="form-control">
          <option value="ALL">-- SEMUA RUANGAN (Grafik Garis) --</option>
          ${opts}
        </select>
      </div>
    `;
    // Admin default pakai metrik dari IGD
    filterMetrikHTML = getMetricFields('igd').map(m => `<option value="${m.id}">${m.label}</option>`).join('');
  } else {
    // Petugas: Terkunci ke ruangannya sendiri
    const tk = state.ruangan.template_key;
    filterMetrikHTML = getMetricFields(tk).map(m => `<option value="${m.id}">${m.label}</option>`).join('');
  }

  const tglHariIni = new Date().toISOString().split('T')[0];
  const thnIni = new Date().getFullYear();

  // 4. Render HTML
  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Dashboard Pelayanan</h2>
      
      <div class="filter-bar" style="align-items:flex-start;">
        ${filterRuanganHTML}
        
        <div class="form-group" style="margin:0; flex:1; min-width:200px;">
          <label style="font-size:.75rem;">Pilih Tahun</label>
          <select id="filter-tahun" class="form-control">
            <option value="${thnIni}">Tahun ${thnIni}</option>
            <option value="${thnIni - 1}">Tahun ${thnIni - 1}</option>
          </select>
        </div>

        <div class="form-group" style="margin:0; flex:1.5; min-width:250px;">
          <label style="font-size:.75rem;">Rentang Tanggal (Mulai - Selesai)</label>
          <input type="text" id="filter-tanggal" class="form-control" placeholder="Pilih rentang tanggal..." readonly>
        </div>

        <div class="form-group" style="margin:0; flex:1; min-width:200px;">
          <label style="font-size:.75rem;">Data Grafik</label>
          <select id="filter-metric" class="form-control">
            ${filterMetrikHTML}
          </select>
        </div>
      </div>
      
      <div style="margin-top:12px; display:flex; gap:8px;">
        <button id="btn-export-excel" class="btn-secondary">📊 Export Excel</button>
        <button id="btn-export-pdf" class="btn-secondary">📄 Export PDF</button>
      </div>
    </div>

    <div class="chart-card" style="margin-top:20px;">
      <div class="chart-wrapper" style="height:400px;"><canvas id="mainChart"></canvas></div>
    </div>
  `;

  // 5. Inisialisasi Flatpickr (2 Kalender)
  const fp = flatpickr("#filter-tanggal", {
    mode: "range",
    dateFormat: "Y-m-d",
    maxDate: "today",
    defaultDate: [tglHariIni, tglHariIni], // Default: hari ini s/d hari ini
    onChange: function(selectedDates) {
      if (selectedDates.length === 2) {
        loadData();
      }
    }
  });

  // 6. Event Listener
  document.getElementById('filter-tahun').addEventListener('change', () => {
    const y = parseInt(document.getElementById('filter-tahun').value);
    // Set default kalender ke awal tahun s/d hari ini
    fp.setDate([`${y}-01-01`, tglHariIni]);
    loadData();
  });

  document.getElementById('filter-metric').addEventListener('change', loadData);
  
  if (isAdmin) {
    document.getElementById('filter-ruangan').addEventListener('change', (e) => {
      const sel = e.target;
      const tk = sel.options[sel.selectedIndex].getAttribute('data-tk') || 'igd';
      
      // Update metrik
      document.getElementById('filter-metric').innerHTML = getMetricFields(tk).map(m => `<option value="${m.id}">${m.label}</option>`).join('');
      loadData();
    });
  }

  // Fungsi Utama Mengambil & Menggambar
  async function loadData() {
    const dates = fp.selectedDates;
    if (dates.length !== 2) return;
    
    const startDate = dates[0].toISOString().split('T')[0];
    const endDate = dates[1].toISOString().split('T')[0];
    const metricId = document.getElementById('filter-metric').value;
    
    let ruanganFilter = "";
    let selectedRuangan = null;

    if (isAdmin) {
      const val = document.getElementById('filter-ruangan').value;
      if (val !== 'ALL') {
        selectedRuangan = ruanganList.find(r => r.id === val);
        ruanganFilter = `&ruangan_id=eq.${val}`; 
      }
    } else {
      selectedRuangan = state.ruangan;
      ruanganFilter = `&ruangan_id=eq.${state.profile.ruangan_id}`;
    }

    // Query ke Supabase (Ambil data mentah)
    let query = supabase.from('laporan')
      .select('id, tanggal, shift, data, petugas_ids, ruangan_id')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: true });

    if (ruanganFilter) query = query.filter('ruangan_id', 'eq', ruanganFilter.split('eq.')[1]);

    const { data, error } = await query;

    if (error) {
      console.error(error);
      return;
    }

    // --- Olah Data untuk Chart ---
    let chartLabels = [];
    let datasets = [];

    if (isAdmin && document.getElementById('filter-ruangan').value === 'ALL') {
      // MODE ADMIN ALL: Grafik Multi-Line per Ruangan
      chartLabels = [...new Set(data.map(d => d.tanggal))].sort();
      
      const colors = ['#16a34a', '#2563eb', '#d97706', '#dc2626', '#7c3aed', '#db2777', '#0d9488'];
      
      datasets = ruanganList.map((r, i) => {
        const dataRuangan = data.filter(d => d.ruangan_id === r.id);
        
        // Sesuaikan nilai
        const dataValues = chartLabels.map(tgl => {
          const lap = dataRuangan.find(d => d.tanggal === tgl);
          return lap ? (lap.data[metricId] || 0) : 0;
        });

        // Sembunyikan garis jika tidak ada laporan sama sekali di rentang ini
        const isHidden = dataRuangan.length === 0;

        return {
          label: r.nama,
          data: dataValues,
          borderColor: colors[i % colors.length],
          backgroundColor: 'transparent',
          borderWidth: 2,
          tension: 0.3,
          hidden: isHidden
        };
      });
    } else {
      // MODE PETUGAS / ADMIN SPESIFIK: Satu Garis
      chartLabels = data.map(d => d.tanggal);
      const template = getTemplate(selectedRuangan ? selectedRuangan.template_key : 'igd');
      
      datasets = [{
        label: template.fields.find(f=>f.id===metricId)?.label || 'Data',
        data: data.map(d => (d.data[metricId] || 0)),
        borderColor: '#16a34a',
        backgroundColor: 'rgba(22, 163, 74, 0.1)',
        borderWidth: 3,
        fill: true,
        tension: 0.3
      }];
    }

    // Ganti Label Tanggal jadi (dd MMM)
    const formattedLabels = chartLabels.map(l => {
      const d = new Date(l);
      return d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short' });
    });

    // --- Gambar Chart ---
    if (myChart) myChart.destroy();
    const ctx = document.getElementById('mainChart').getContext('2d');
    
    myChart = new Chart(ctx, {
      type: 'line',
      data: { labels: formattedLabels, datasets: datasets },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { position: 'bottom' } },
        scales: {
          y: { beginAtZero: true, grid: { borderDash: [2, 4] } },
          x: { grid: { display: false } }
        }
      }
    });

    // Simpan data untuk export
    container.dataset.rawData = JSON.stringify(data);
    container.dataset.staffMap = JSON.stringify(staffMap);
    container.dataset.startDate = startDate;
    container.dataset.endDate = endDate;
  }

  // Event Export
  document.getElementById('btn-export-excel').addEventListener('click', () => {
    exportData(container, 'excel', isAdmin, document.getElementById('filter-ruangan')?.value, ruanganList);
  });
  document.getElementById('btn-export-pdf').addEventListener('click', () => {
    exportData(container, 'pdf', isAdmin, document.getElementById('filter-ruangan')?.value, ruanganList);
  });

  // Muat data pertama kali (Default: hari ini)
  await loadData();
}

/* =========================================================
   LOGIKA EXPORT (Dinamis Menyesuaikan Mode Grafik)
   ========================================================= */
function exportData(container, type, isAdmin, filterRuanganVal, ruanganList) {
  if (!container.dataset.rawData) return alert("Tidak ada data.");
  const data = JSON.parse(container.dataset.rawData);
  if (data.length === 0) return alert("Data kosong di rentang tanggal ini.");

  const staffMap = JSON.parse(container.dataset.staffMap);
  
  // Siapkan Header
  let headers = ['Tanggal', 'Shift', 'Petugas', 'Ruangan'];
  
  // Kumpulkan semua key metric dari data JSONB (buang tanggal/shift)
  const keys = Object.keys(data[0].data).filter(k => k !== 'tanggal' && k !== 'shift');
  const labels = keys.map(k => k.replace(/_/g, ' ').toUpperCase());

  headers = headers.concat(labels);

  // Siapkan Body
  const rows = data.map(d => {
    const petugasNames = (d.petugas_ids || []).map(id => staffMap[id] || 'Unknown').join(', ');
    const rName = ruanganList.find(r => r.id === d.ruangan_id)?.nama || '-';
    
    const row = [d.tanggal, d.shift || '-', petugasNames, rName];
    keys.forEach(k => row.push(d.data[k] || 0));
    
    return row;
  });

  const title = `Laporan_${container.dataset.startDate}_sd_${container.dataset.endDate}`;

  if (type === 'excel') {
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Data Laporan");
    XLSX.writeFile(wb, `${title}.xlsx`);
  } else {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    doc.setFontSize(14);
    doc.text(`Laporan Instalasi Farmasi (${container.dataset.startDate} s/d ${container.dataset.endDate})`, 14, 15);
    
    doc.autoTable({
      head: [headers],
      body: rows,
      startY: 22,
      styles: { fontSize: 7 },
      headStyles: { fillColor: [22, 163, 74] }
    });
    doc.save(`${title}.pdf`);
  }
}
