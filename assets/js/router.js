// assets/js/router.js
import { supabase } from './supabase.js';
import { renderFormInput } from './laporan.js'; // Import ditaruh di paling atas
import { renderDaftarStaff } from './staff.js';           // <-- TAMBAHKAN INI
import { renderPengaturan as loadPengaturan } from './pengaturan.js'; // <-- TAMBAHKAN INI
import { renderDashboard as loadDashboard } from './dashboard.js'; // <-- TAMBAHKAN INI (BARIS BARU)
import { renderLaporanPelayanan } from './laporan_pelayanan.js';
import { renderPresensi } from './presensi.js';
import { renderPencarianStaff } from './pencarian_staff.js';
import { renderLaporanHarian } from './laporan_harian.js';

// State global user
export const state = {
  profile: null,   // { role, ruangan_id }
  ruangan: null,   // { nama, template_key, punya_shift }
};

// DOM Elements
const sidebar = document.getElementById('sidebar');
const overlay = document.getElementById('sidebar-overlay');
const btnHamburger = document.getElementById('btn-toggle-sidebar');
const btnLogout = document.getElementById('btn-logout');
const navItems = document.querySelectorAll('.nav-item');
const view = document.getElementById('view');

/* =========================================================
   1. GUARD & INISIALISASI
   ========================================================= */
async function initAuth() {
  // 1) Cek sesi
  const { data: { session }, error: authErr } = await supabase.auth.getSession();
  if (!session || authErr) {
    window.location.replace('index.html');
    return false;
  }

  // 2) Ambil profil
  const { data: profile, error: pErr } = await supabase
    .from('user_profiles')
    .select('role, ruangan_id, ruangan(id, nama, template_key, punya_shift)')
    .eq('id', session.user.id)
    .single();

  if (pErr || !profile) {
    console.error(pErr);
    await supabase.auth.signOut();
    window.location.replace('index.html');
    return false;
  }

  // 3) Simpan ke state
  state.profile = profile;
  state.ruangan = profile.ruangan;

  // 4) Update UI (Header & Sidebar)
  document.getElementById('ruangan-nama').textContent = profile.role === 'admin' 
    ? 'Administrator Pusat' 
    : (profile.ruangan?.nama || 'Ruangan Tidak Diketahui');

  const badge = document.getElementById('user-role');
  badge.textContent = profile.role === 'admin' ? 'ADMIN' : 'PETUGAS';
  
  const inisial = profile.role === 'admin' ? 'A' : (profile.ruangan?.nama?.match(/[A-Z]/g)?.slice(0,1).join('') || '?');
  document.getElementById('user-avatar').textContent = inisial;

  if (profile.role === 'admin') {
    document.querySelectorAll('.admin-only').forEach(el => el.hidden = false);
  }

  return true;
}

/* =========================================================
   2. ROUTING
   ========================================================= */
const routes = {
  'dashboard': renderDashboard,
  'input': renderInput,
  'laporan-pelayanan': renderLaporanPelayanan, // Rute Baru
  'staff': renderStaff,
  'presensi': renderPresensi,
  'pencarian-staff': renderPencarianStaff,
  'laporan-harian': renderLaporanHarian,
  'pengaturan': renderPengaturan
};

async function handleRoute() {
  let hash = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  
  if (!routes[hash]) hash = 'dashboard';

  if (hash === 'pengaturan' && state.profile.role !== 'admin') {
    window.location.hash = '#/dashboard';
    return;
  }

  navItems.forEach(el => {
    if (el.dataset.route === hash) el.classList.add('active');
    else el.classList.remove('active');
  });

  closeSidebar();

  try {
    view.innerHTML = `<div class="loading-state"><div class="spinner spinner-dark"></div> Memuat…</div>`;
    await routes[hash](view, state);
  } catch (err) {
    console.error(`Error rendering ${hash}:`, err);
    view.innerHTML = `<div class="login-error">Terjadi kesalahan saat memuat halaman. Cek Console.</div>`;
  }
}

/* =========================================================
   3. RENDER FUNCTIONS (PLACEHOLDER & IMPORT)
   ========================================================= */
async function renderDashboard() {
  // Panggil fungsi dashboard yang sesungguhnya
  await loadDashboard(view, state);
}

async function renderInput() {
  // Memanggil form dari laporan.js dan mengirimkan state
  await renderFormInput(view, state);
}

async function renderStaff() {
  await renderDaftarStaff(view, state);
}

async function renderPengaturan() {
  await loadPengaturan(view, state);
}
/* =========================================================
   4. EVENT LISTENERS & UTILS
   ========================================================= */
function openSidebar() {
  if (window.innerWidth <= 768) {
    sidebar.classList.add('open');
    overlay.hidden = false;
  }
}
function closeSidebar() {
  sidebar.classList.remove('open');
  overlay.hidden = true;
}

btnHamburger.addEventListener('click', openSidebar);
overlay.addEventListener('click', closeSidebar);

btnLogout.addEventListener('click', async () => {
  await supabase.auth.signOut();
  window.location.replace('index.html');
});

window.addEventListener('hashchange', handleRoute);

/* =========================================================
   5. START APP
   ========================================================= */
(async () => {
  const ok = await initAuth();
  if (ok) {
    if (!window.location.hash) window.location.hash = '#/dashboard';
    handleRoute(); 
  }
})();
