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
        <table class="data-table" id="table-laporan">
          <thead id="table-head"></thead>
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
    const table = document.getElementById('table-laporan');
    
    table.innerHTML = `<thead></thead><tbody><tr><td colspan="10" style="text-align:center;"><div class="spinner spinner-dark"></div> Memuat data...</td></tr></tbody>`;

    let valRuangan, templateKey;
    if (isAdmin) {
      const sel = document.getElementById('filter-ruangan');
      valRuangan = sel.value;
      templateKey = sel.options[sel.selectedIndex].getAttribute('data-tk');
    } else {
      valRuangan = state.profile.ruangan_id;
      templateKey = state.ruangan.template_key;
    }

    // QUERY HANYA SEKALI (Termasuk ID untuk keperluan Edit)
    const { data, error } = await supabase.from('laporan')
      .select('id, tanggal, shift, data, petugas_ids, ruangan_id')
      .eq('ruangan_id', valRuangan)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false }); 

    if (error) {
      table.innerHTML = `<thead></thead><tbody><tr><td colspan="10" class="login-error">Gagal memuat: ${error.message}</td></tr></tbody>`;
      return;
    }

    if (data.length === 0) {
      table.innerHTML = `<thead></thead><tbody><tr><td colspan="10" style="text-align:center;">Tidak ada data pada rentang ini.</td></tr></tbody>`;
      return;
    }

    // Simpan data mentah ke memori
    window.rawLaporanData = data;

    const template = getTemplate(templateKey);
    const numFields = template.fields.filter(f => f.type === 'number' && f.metric);
    
    // Rakit Header
    let headHTML = `<tr>
      <th style="width: 100px;">Tanggal</th>
      <th style="width: 80px;">Shift</th>`;
      
    numFields.forEach(f => {
      // Potong teks label yang panjang agar tidak melebar
      let labelPendek = f.label.replace(/Jumlah |Resep |Pasien /g, ''); 
      headHTML += `<th style="text-align:center; font-size:0.75rem; padding:8px 4px; width: 80px;">${labelPendek}</th>`;
    }); // <-- HANYA SATU KURUNG TUTUP DI SINI
    
    headHTML += `<th style="width:70px; font-size:0.75rem; text-align:center;">Aksi</th></tr>`;

    // Rakit Body
    let bodyHTML = '';
    data.forEach(d => {
      bodyHTML += `<tr>
        <td style="white-space:nowrap; font-weight:600;">${new Date(d.tanggal).toLocaleDateString('id-ID')}</td>
        <td style="text-transform: uppercase; font-weight:600; color:var(--green-700);">${d.shift ? d.shift : '-'}</td>
      `;
      numFields.forEach(f => {
        let val = d.data[f.id];
        if (val === undefined) val = d.data[`jumlah_${f.id}`] || 0;
        // Rata kanan & perlebar sedikit
        bodyHTML += `<td class="text-right" style="padding:6px 8px; font-size:0.8rem;">${val}</td>`;
      });
      
      // TOMBOL EDIT TETAP ADA
      bodyHTML += `<td style="text-align:center; padding:6px 4px;">
          <button type="button" class="btn-secondary btn-edit-lap" data-id="${d.id}" style="padding:4px 6px; font-size:0.75rem; border-color:var(--gray-300); color:var(--gray-700);">✏️ Edit</button>
        </td>
      </tr>`;
    });

    // Render Tabel
    table.innerHTML = `<thead>${headHTML}</thead><tbody>${bodyHTML}</tbody>`;

    // EVENT LISTENER UNTUK TOMBOL EDIT
    document.querySelectorAll('.btn-edit-lap').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const lap = window.rawLaporanData.find(item => item.id === id);
        
        if (lap) {
          sessionStorage.setItem('edit_laporan', JSON.stringify(lap));
          window.location.hash = '#/input'; // Pindah ke form input
        }
      });
    });
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
