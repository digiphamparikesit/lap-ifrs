// assets/js/pencarian_staff.js
import { supabase } from './supabase.js';

export async function renderPencarianStaff(container, state) {
  // Ambil daftar semua staff
  const { data: masterStaff } = await supabase.from('staff').select('id, nama').order('nama');

  // Tampilan Filter
  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Pencarian Riwayat Staff</h2>
      <p style="color:var(--gray-500); margin-bottom:16px;">Cari tahu di ruangan mana saja staff ini pernah bertugas.</p>
      
      <div class="filter-bar" style="align-items:flex-end; display:flex; flex-wrap:wrap; gap:12px; background:#fff; padding:16px; border-radius:12px; border:1px solid var(--gray-200); margin-bottom:24px;">
        
        <div class="form-group" style="margin:0; flex:2; min-width:250px;">
          <label style="font-size:.75rem;">Pilih Nama Staff</label>
          <select id="filter-staff" class="form-control">
            <option value="">-- Pilih Staff --</option>
            ${masterStaff.map(s => `<option value="${s.id}" data-nama="${s.nama}">${s.nama}</option>`).join('')}
          </select>
        </div>

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
      </div>
    </div>

    <div class="table-card">
      <h3 class="section-title" id="table-title">Riwayat Penempatan Staff</h3>
      <div class="table-responsive">
        <table class="data-table" id="table-riwayat">
          <thead>
            <tr>
              <th style="width: 50px;">No</th>
              <th>Nama Ruangan</th>
              <th style="text-align:center;">Total Shift Masuk</th>
              <th>Tanggal Terakhir Bertugas</th>
            </tr>
          </thead>
          <tbody id="table-body">
            <tr><td colspan="4" style="text-align:center;">Silakan pilih staff dan rentang tanggal.</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

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

  document.getElementById('filter-staff').addEventListener('change', loadData);

  async function loadData() {
    const staffId = document.getElementById('filter-staff').value;
    const dates = fp.selectedDates;
    if (!staffId || dates.length !== 2) return;
    
    const startDate = dates[0].toISOString().split('T')[0];
    const endDate = dates[1].toISOString().split('T')[0];
    const tableBody = document.getElementById('table-body');
    const tableTitle = document.getElementById('table-title');
    
    const selStaff = document.getElementById('filter-staff');
    const staffName = selStaff.options[selStaff.selectedIndex].getAttribute('data-nama');
    
    tableTitle.textContent = `Riwayat Penempatan: ${staffName}`;
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;"><div class="spinner spinner-dark"></div> Mencari data...</td></tr>`;

    // Ambil semua laporan di rentang tanggal tersebut (SEMUA RUANGAN)
    const { data, error } = await supabase.from('laporan')
      .select('ruangan_id, tanggal, petugas_ids, data, ruangan(nama)')
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false });

    if (error) {
      tableBody.innerHTML = `<tr><td colspan="4" class="login-error">Gagal memuat: ${error.message}</td></tr>`;
      return;
    }

    const rekap = {}; 
    
    data.forEach(lap => {
      let isHadir = false;

      // 1. Cek berdasarkan UUID (Data Baru)
      if (lap.petugas_ids && lap.petugas_ids.includes(staffId)) {
        isHadir = true;
      }
      
      // 2. Cek berdasarkan Teks di JSON (Data Lama dari Excel)
      if (!isHadir && lap.data) {
        Object.values(lap.data).forEach(val => {
          if (typeof val === 'string' && val.trim() !== '' && !isNaN(val) === false) {
             // Cocokkan nama depan (sebelum koma)
             const namaDepan = staffName.toLowerCase().split(',')[0];
             if (val.toLowerCase().includes(namaDepan)) {
                isHadir = true;
             }
          }
        });
      }

      if (isHadir) {
        const rName = lap.ruangan?.nama || 'Ruangan Tidak Dikenal';
        if (!rekap[rName]) rekap[rName] = { count: 0, lastDate: lap.tanggal };
        rekap[rName].count++;
        if (lap.tanggal > rekap[rName].lastDate) rekap[rName].lastDate = lap.tanggal;
      }
    });

    const resultArray = Object.keys(rekap).map(rName => ({
      ruangan: rName,
      total: rekap[rName].count,
      lastDate: rekap[rName].lastDate
    })).sort((a, b) => b.total - a.total);

    if (resultArray.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Staff ini tidak memiliki catatan shift di rentang tanggal tersebut.</td></tr>`;
      return;
    }

    let bodyHTML = '';
    resultArray.forEach((st, index) => {
      bodyHTML += `<tr>
        <td>${index + 1}</td>
        <td style="font-weight:bold; color:var(--green-800);">${st.ruangan}</td>
        <td style="text-align:center;"><span class="badge" style="font-size:1rem; padding:4px 12px; background:var(--green-600); color:#fff;">${st.total} Shift</span></td>
        <td>${new Date(st.lastDate).toLocaleDateString('id-ID')}</td>
      </tr>`;
    });
    tableBody.innerHTML = bodyHTML;
  }
}
