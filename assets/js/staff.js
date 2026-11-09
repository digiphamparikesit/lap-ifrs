// assets/js/staff.js
import { supabase } from './supabase.js';

export async function renderDaftarStaff(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  container.innerHTML = `
    <div class="dashboard-header">
      <h2 class="page-title">Daftar Staff Instalasi Farmasi</h2>
      <p style="color:var(--gray-500); margin-bottom:16px;">
        ${isAdmin ? 'Anda login sebagai Admin. Anda dapat menambah staff dan mengatur penempatan ruangan.' : 'Daftar staff yang terdaftar di ruangan Anda.'}
      </p>
      ${isAdmin ? `<button id="btn-tambah-staff" class="btn-primary" style="width:auto; padding: 10px 20px;">+ Tambah Staff Baru</button>` : ''}
    </div>

    <div class="table-card">
      <div class="table-responsive">
        <table class="data-table" id="table-staff">
          <thead>
            <tr>
              <th>Nama Staff</th>
              <th>Penempatan Ruangan</th>
              ${isAdmin ? '<th>Aksi</th>' : ''}
            </tr>
          </thead>
          <tbody id="tbody-staff">
            <tr><td colspan="${isAdmin ? 3 : 2}" style="text-align:center;">Memuat data…</td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;

  if (isAdmin) {
    document.getElementById('btn-tambah-staff').addEventListener('click', () => formTambahStaff(container, state));
  }

  await muatTabelStaff(container, state);
}

/* =========================================================
   MUAT TABEL STAFF
   ========================================================= */
async function muatTabelStaff(container, state) {
  const isAdmin = state.profile.role === 'admin';
  const tbody = document.getElementById('tbody-staff');
  
  // Ambil semua staff beserta ruangannya
  let query = supabase.from('staff').select(`
    id, nama,
    staff_ruangan ( ruangan_id, ruangan ( nama ) )
  `).eq('aktif', true).order('nama');

  const { data: staffData, error } = await query;

  if (error) {
    tbody.innerHTML = `<tr><td colspan="3" class="login-error">Gagal memuat staff: ${error.message}</td></tr>`;
    return;
  }

  // Ambil daftar semua ruangan (untuk modal edit admin)
  const { data: ruanganList } = await supabase.from('ruangan').select('id, nama').order('kode');

  tbody.innerHTML = staffData.map(s => {
    // Kumpulkan nama ruangan
    let ruangStr = s.staff_ruangan.map(sr => sr.ruangan?.nama).join(', ');
    if (!ruangStr) ruangStr = '<span style="color:var(--danger);">Belum ada ruangan</span>';

    return `
      <tr>
        <td style="font-weight:600; color:var(--green-900);">${s.nama}</td>
        <td>${ruangStr}</td>
        ${isAdmin ? `
          <td>
            <button class="btn-secondary btn-edit-staff" data-id="${s.id}" data-nama="${s.nama}" style="padding:4px 10px; font-size:.8rem;">Edit Ruangan</button>
          </td>
        ` : ''}
      </tr>
    `;
  }).join('');

  // Pasang event listener untuk tombol Edit (Admin)
  if (isAdmin) {
    document.querySelectorAll('.btn-edit-staff').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const id = e.target.dataset.id;
        const nama = e.target.dataset.nama;
        
        // Cari staff ini di data asli untuk tahu ruangan mana saja yang dicentang
        const staff = staffData.find(st => st.id === id);
        const currentRuanganIds = staff.staff_ruangan.map(sr => sr.ruangan_id);
        
        bukaModalEditRuangan(id, nama, currentRuanganIds, ruanganList, container, state);
      });
    });
  }
}

/* =========================================================
   MODAL TAMBAH STAFF BARU (Admin)
   ========================================================= */
function formTambahStaff(container, state) {
  const newName = prompt("Masukkan Nama Lengkap & Gelar Staff Baru:");
  if (!newName || newName.trim() === '') return;

  supabase.from('staff').insert({ nama: newName.trim() }).then(({ error }) => {
    if (error) return alert("Gagal menambah staff: " + error.message);
    alert("✅ Staff berhasil ditambahkan! Silakan klik 'Edit Ruangan' untuk menempatkannya.");
    muatTabelStaff(container, state);
  });
}

/* =========================================================
   MODAL EDIT RUANGAN STAFF (Admin)
   ========================================================= */
function bukaModalEditRuangan(staffId, staffNama, currentRuanganIds, ruanganList, container, state) {
  // Buat HTML Modal (Menggunakan <dialog> agar mudah)
  const dialog = document.createElement('dialog');
  dialog.style.padding = '24px';
  dialog.style.borderRadius = '12px';
  dialog.style.border = '1px solid var(--gray-200)';
  dialog.style.width = '90%';
  dialog.style.maxWidth = '400px';
  
  const checkboxes = ruanganList.map(r => {
    const checked = currentRuanganIds.includes(r.id) ? 'checked' : '';
    return `
      <label style="display:flex; align-items:center; gap:8px; margin-bottom:12px; cursor:pointer;">
        <input type="checkbox" name="ruangan" value="${r.id}" ${checked} style="width:18px; height:18px;">
        <span>${r.nama}</span>
      </label>
    `;
  }).join('');

  dialog.innerHTML = `
    <h3 style="margin-top:0; color:var(--green-800);">Penempatan Ruangan</h3>
    <p style="font-size:.9rem; color:var(--gray-500); margin-bottom:16px;">Staff: <b>${staffNama}</b></p>
    <div style="max-height:300px; overflow-y:auto; padding-right:8px;">
      ${checkboxes}
    </div>
    <div style="display:flex; justify-content:flex-end; gap:8px; margin-top:20px;">
      <button id="btn-cancel-modal" class="btn-secondary" style="border-color:var(--gray-300); color:var(--gray-700);">Batal</button>
      <button id="btn-save-modal" class="btn-primary" style="width:auto;">Simpan</button>
    </div>
  `;

  document.body.appendChild(dialog);
  dialog.showModal();

  document.getElementById('btn-cancel-modal').onclick = () => {
    dialog.close();
    dialog.remove();
  };

  document.getElementById('btn-save-modal').onclick = async () => {
    const btn = document.getElementById('btn-save-modal');
    btn.disabled = true;
    btn.textContent = 'Menyimpan...';

    // 1. Dapatkan centang baru
    const checkboxes = dialog.querySelectorAll('input[name="ruangan"]:checked');
    const newRuanganIds = Array.from(checkboxes).map(cb => cb.value);

    try {
      // 2. Hapus mapping lama
      await supabase.from('staff_ruangan').delete().eq('staff_id', staffId);

      // 3. Insert mapping baru (jika ada yang dicentang)
      if (newRuanganIds.length > 0) {
        const inserts = newRuanganIds.map(rId => ({ staff_id: staffId, ruangan_id: rId }));
        const { error } = await supabase.from('staff_ruangan').insert(inserts);
        if (error) throw error;
      }

      dialog.close();
      dialog.remove();
      muatTabelStaff(container, state); // Refresh tabel
      
    } catch (err) {
      console.error(err);
      alert("Gagal menyimpan penempatan: " + err.message);
      btn.disabled = false;
      btn.textContent = 'Simpan';
    }
  };
}
