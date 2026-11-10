// assets/js/presensi.js
import { supabase } from './supabase.js';

export async function renderPresensi(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  let listRuangan = [];
  if (isAdmin) {
    const { data } = await supabase.from('ruangan').select('id, nama').neq('kode', 'ADMIN').order('kode');
    listRuangan = data || [];
  }

  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Presensi / Kehadiran Staff</h2>
      <div class="filter-bar" style="align-items:flex-end; display:flex; flex-wrap:wrap; gap:12px; background:#fff; padding:16px; border-radius:12px; border:1px solid var(--gray-200); margin-bottom:24px;">
        ${isAdmin ? `
        <div class="form-group" style="margin:0; flex:1; min-width:200px;">
          <label style="font-size:.75rem;">Pilih Ruangan</label>
          <select id="filter-ruangan" class="form-control">
            ${listRuangan.map(r => `<option value="${r.id}">${r.nama}</option>`).join('')}
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
      </div>
    </div>

    <div class="table-card">
      <h3 class="section-title">Rekap Kehadiran Staff</h3>
      <div class="table-responsive">
        <table class="data-table" id="table-presensi">
          <thead>
            <tr>
              <th style="width: 50px;">No</th>
              <th>Nama Staff</th>
              <th style="text-align:center;">Total Shift Masuk</th>
              <th>Tanggal Terakhir Bertugas</th>
            </tr>
          </thead>
          <tbody id="table-body">
            <tr><td colspan="4" style="text-align:center;">Memuat data...</td></tr>
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

  if (isAdmin) {
    document.getElementById('filter-ruangan').addEventListener('change', loadData);
  }

  async function loadData() {
    const dates = fp.selectedDates;
    if (dates.length !== 2) return;
    
    const startDate = dates[0].toISOString().split('T')[0];
    const endDate = dates[1].toISOString().split('T')[0];
    const tableBody = document.getElementById('table-body');
    
    tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;"><div class="spinner spinner-dark"></div> Memuat data...</td></tr>`;

    let valRuangan = isAdmin ? document.getElementById('filter-ruangan').value : state.profile.ruangan_id;

    // Ambil data laporan
    const { data, error } = await supabase.from('laporan')
      .select('tanggal, petugas_ids, data')
      .eq('ruangan_id', valRuangan)
      .gte('tanggal', startDate)
      .lte('tanggal', endDate)
      .order('tanggal', { ascending: false });

    if (error) {
      tableBody.innerHTML = `<tr><td colspan="4" class="login-error">Gagal memuat: ${error.message}</td></tr>`;
      return;
    }

    // Ambil master data staff
    const { data: staffList } = await supabase.from('staff').select('id, nama');
    const staffMap = {};
    if (staffList) staffList.forEach(s => staffMap[s.id] = s.nama);

    const rekap = {}; 
    const hitungNama = (nama, tanggal) => {
      // Bersihkan spasi dan cek
      const cleanName = nama.trim();
      if (!cleanName) return;
      
      // Cari apakah nama ini ada di master staff (untuk menyeragamkan ejaan)
      const match = Object.values(staffMap).find(nAsli => 
        nAsli.toLowerCase().includes(cleanName.toLowerCase().split(',')[0])
      );
      
      const finalName = match || cleanName;

      if (!rekap[finalName]) rekap[finalName] = { count: 0, lastDate: tanggal };
      rekap[finalName].count++;
      if (tanggal > rekap[finalName].lastDate) rekap[finalName].lastDate = tanggal;
    };

    data.forEach(lap => {
      // 1. Baca dari inputan baru (UUID)
      if (lap.petugas_ids && lap.petugas_ids.length > 0) {
        lap.petugas_ids.forEach(id => {
          hitungNama(staffMap[id] || 'Staff Baru', lap.tanggal);
        });
      }
      
      // 2. Baca dari data migrasi Excel (Teks)
      if (lap.data) {
        Object.keys(lap.data).forEach(key => {
          // SANGAT KETAT: Hanya ambil key yang ada kata "petugas" tapi BUKAN "ids"
          if (key.toLowerCase().includes('petugas') && !key.toLowerCase().includes('ids')) {
            let val = lap.data[key];
            
            // Pastikan isinya string dan bukan angka
            if (typeof val === 'string' && val.trim() !== '' && isNaN(val)) {
              // Pisahkan jika ada koma (misal: "Budi, Ani")
              const listNama = val.split(',').map(s => s.trim());
              listNama.forEach(n => hitungNama(n, lap.tanggal));
            }
          }
        });
      }
    });

    const resultArray = Object.keys(rekap).map(nama => ({
      nama: nama,
      total: rekap[nama].count,
      lastDate: rekap[nama].lastDate
    })).sort((a, b) => b.total - a.total);

    if (resultArray.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="4" style="text-align:center;">Tidak ada data presensi pada rentang ini.</td></tr>`;
      return;
    }

    let bodyHTML = '';
    resultArray.forEach((st, index) => {
      bodyHTML += `<tr>
        <td>${index + 1}</td>
        <td style="font-weight:bold; color:var(--green-800);">${st.nama}</td>
        <td style="text-align:center;"><span class="badge" style="font-size:1rem; padding:4px 12px;">${st.total} Shift</span></td>
        <td>${new Date(st.lastDate).toLocaleDateString('id-ID')}</td>
      </tr>`;
    });
    tableBody.innerHTML = bodyHTML;
  }

  await loadData();
}
