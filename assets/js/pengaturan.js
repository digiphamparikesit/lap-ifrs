// assets/js/pengaturan.js
import { supabase } from './supabase.js';

export async function renderPengaturan(container, state) {
  if (state.profile.role !== 'admin') {
    container.innerHTML = `<div class="login-error">Akses Ditolak. Halaman ini khusus Admin.</div>`;
    return;
  }

  container.innerHTML = `
    <h2 class="page-title">Pengaturan Sistem</h2>
    
    <div class="chart-card" style="margin-bottom:20px;">
      <h3 style="color:var(--green-800); margin-top:0;">Daftar Akun Ruangan (Login)</h3>
      <p style="font-size:.9rem; color:var(--gray-500); margin-bottom:16px;">
        Gunakan email dan PIN ini untuk login ke aplikasi. (Password/PIN dapat diubah melalui Supabase Dashboard -> Authentication).
      </p>
      <div class="table-responsive">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nama Ruangan</th>
              <th>Email Login</th>
            </tr>
          </thead>
          <tbody id="tbody-akun">
            <tr><td colspan="2">Memuat data...</td></tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="chart-card">
      <h3 style="color:var(--green-800); margin-top:0;">Panduan Admin</h3>
      <ul style="color:var(--gray-700); font-size:.9rem; line-height:1.6;">
        <li>Buka menu <b>Daftar Staff</b> untuk menambahkan staff baru atau memetakan staff ke ruangan tertentu.</li>
        <li>Jika ada laporan yang salah input oleh petugas, saat ini admin dapat menghapusnya langsung melalui <i>Table Editor</i> di dashboard Supabase (tabel <code>laporan</code>).</li>
      </ul>
    </div>
  `;

  const { data, error } = await supabase.from('ruangan').select('nama, email_auth').order('kode');
  
  if (!error && data) {
    document.getElementById('tbody-akun').innerHTML = data.map(r => `
      <tr>
        <td style="font-weight:600;">${r.nama}</td>
        <td><code style="background:var(--gray-100); padding:4px 8px; border-radius:4px;">${r.email_auth}</code></td>
      </tr>
    `).join('');
  }
}
