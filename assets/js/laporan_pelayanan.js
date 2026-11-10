// assets/js/laporan_pelayanan.js
import { supabase } from './supabase.js';
import { getTemplate } from './templates.js';

export async function renderLaporanPelayanan(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  // Ambil daftar ruangan (khusus admin)
  let listRuangan = [];
  if (isAdmin) {
    const { data } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');
    listRuangan = data || [];
  }

    // Tampilan Filter
  container.innerHTML = `
    <div class="dashboard-header" style="position: sticky; top: 0; z-index: 10; background: var(--gray-50); padding-top: 10px; margin-top: -10px; padding-bottom: 10px;">
      <h2 class="page-title" style="margin-top: 10px;">Laporan Pelayanan</h2>
      
      <div class="filter-bar" style="align-items:flex-end; display:flex; flex-wrap:wrap; gap:12px; background:#fff; padding:16px; border-radius:12px; border:1px solid var(--gray-200); margin-bottom: 10px; box-shadow: var(--shadow-sm);">
        
        ${isAdmin ? `
        <div class="form-group" style="margin:0; flex:1; min-width:200px;">
          <label style="font-size:.75rem;">Pilih Ruangan</label>
          <select id="filter-ruangan" class="form-control">
            ${listRuangan.map(r => `<option value="${r.id}" data-tk="${r.template_key}">${r.nama}</option>`).join('')}
          </select>
        </div>` : ''}

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

    <div class="table-card">
      <div class="table-responsive">
        <!-- Tambahkan style sticky untuk header tabel (thead) -->
        <table class="data-table" id="table-laporan">
          <thead id="table-head" style="position: sticky; top: 190px; z-index: 5; background: var(--gray-50);"></thead>
          <tbody id="table-body">
            <tr><td colspan="10" style="text-align:center;">Memuat data...</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  // Inisialisasi Kalender
  const today = new Date();
  const startOfYear = new Date(today.getFullYear(), 0, 1);
  const fp = flatpickr("#filter-tanggal", {
    mode: "range",
    dateFormat: "Y-m-d",
    defaultDate: [startOfYear, today],
    onChange: function(selectedDates) {
      if (selectedDates.length === 2) loadData();
    }
  });

  document.getElementById('filter-tahun').addEventListener('change', (e) => {
    const year = parseInt(e.target.value);
    fp.setDate([`${year}-01-01`, `${year}-12-31`]);
    loadData();
  });

  if (isAdmin) {
    document.getElementById('filter-ruangan').addEventListener('change', loadData);
  }

  // Fungsi Load Data Tabel
  async function loadData() {
    const dates = fp.selectedDates;
    if (dates.length !== 2) return;
    
    const startDate = dates[0].toISOString().split('T')[0];
    const endDate = dates[1].toISOString().split('T')[0];
    const tableHead = document.getElementById('table-head');
    const tableBody = document.getElementById('table-body');
    
    tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;"><div class="spinner spinner-dark"></div> Memuat data...</td></tr>`;

    let valRuangan, templateKey;
    if (isAdmin) {
      const sel = document.getElementById('filter-ruangan');
      valRuangan = sel.value;
      templateKey = sel.options[sel.selectedIndex].getAttribute('data-tk');
    } else {
      valRuangan = state.profile.ruangan_id;
      templateKey = state.ruangan.template_key;
    }

    const { data, error } = await supabase.from('laporan')
      .select('tanggal, shift, data')
      .eq('ruangan_id', valRuangan)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false }); // Urutkan dari terbaru

    if (error) {
      tableBody.innerHTML = `<tr><td colspan="10" class="login-error">Gagal memuat: ${error.message}</td></tr>`;
      return;
    }

    if (data.length === 0) {
      tableHead.innerHTML = '';
      tableBody.innerHTML = `<tr><td colspan="10" style="text-align:center;">Tidak ada data pada rentang ini.</td></tr>`;
      return;
    }

    // Buat Header Tabel Dinamis
    const template = getTemplate(templateKey);
    const numFields = template.fields.filter(f => f.type === 'number' && f.metric);
    
    let headHTML = `<tr><th>Tanggal</th><th>Shift</th>`;
    numFields.forEach(f => {
      headHTML += `<th>${f.label}</th>`;
    });
    headHTML += `</tr>`;
    tableHead.innerHTML = headHTML;

    // Buat Body Tabel
    let bodyHTML = '';
    data.forEach(d => {
      bodyHTML += `<tr>
        <td style="white-space:nowrap;">${new Date(d.tanggal).toLocaleDateString('id-ID')}</td>
        <td>${d.shift ? d.shift.toUpperCase() : '-'}</td>
      `;
      numFields.forEach(f => {
        let val = d.data[f.id];
        if (val === undefined) val = d.data[`jumlah_${f.id}`] || 0;
        bodyHTML += `<td>${val}</td>`;
      });
      bodyHTML += `</tr>`;
    });
    tableBody.innerHTML = bodyHTML;
  }

  // Event Export Excel
  document.getElementById('btn-export-excel').addEventListener('click', () => {
    const table = document.getElementById('table-laporan');
    if (!table || table.rows.length <= 1) return alert("Tidak ada data untuk diexport.");
    
    const wb = XLSX.utils.table_to_book(table, {sheet: "Laporan"});
    XLSX.writeFile(wb, `Laporan_Pelayanan_${new Date().toISOString().split('T')[0]}.xlsx`);
  });

  // Event Export PDF
  document.getElementById('btn-export-pdf').addEventListener('click', () => {
    const table = document.getElementById('table-laporan');
    if (!table || table.rows.length <= 1) return alert("Tidak ada data untuk diexport.");

    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('landscape');
    
    doc.setFontSize(16);
    doc.text("Laporan Pelayanan Instalasi Farmasi", 14, 15);
    doc.setFontSize(10);
    doc.text(`Dicetak pada: ${new Date().toLocaleString('id-ID')}`, 14, 22);

    doc.autoTable({
      html: '#table-laporan',
      startY: 28,
      styles: { fontSize: 8 },
      headStyles: { fillColor: [22, 163, 74] }
    });

    doc.save(`Laporan_Pelayanan_${new Date().toISOString().split('T')[0]}.pdf`);
  });

  // Panggil pertama kali
  await loadData();
}
