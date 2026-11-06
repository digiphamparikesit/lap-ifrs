// assets/js/router.js
import { supabase } from './supabase.js';

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
    .select('role, ruangan_id, ruangan(nama, template_key, punya_shift)')
    .eq('id', session.user.id)
    .single();

  if (pErr || !profile) {
    console.error(pErr);
    // Kalau error profil, logout paksa (daripada bug aneh)
    await supabase.auth.signOut();
    window.location.replace('index.html');
    return false;
  }

  // 3) Simpan ke state
  state.profile = profile;
  state.ruangan = profile.ruangan;

  // 4) Update UI (Header & Sidebar)
  const userEmail = session.user.email;
  
  // Set nama ruangan atau "Administrator"
  document.getElementById('ruangan-nama').textContent = profile.role === 'admin' 
    ? 'Administrator Pusat' 
    : (profile.ruangan?.nama || 'Ruangan Tidak Diketahui');

  // Set badge role
  const badge = document.getElementById('user-role');
  badge.textContent = profile.role === 'admin' ? 'ADMIN' : 'PETUGAS';
  
  // Set Avatar inisial (IGD -> I, RJM -> R, Admin -> A)
  const inisial = profile.role === 'admin' ? 'A' : (profile.ruangan?.nama?.match(/[A-Z]/g)?.slice(0,1).join('') || '?');
  document.getElementById('user-avatar').textContent = inisial;

  // Tampilkan menu admin jika role == admin
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
  'staff': renderStaff,
  'pengaturan': renderPengaturan
};

async function handleRoute() {
  // Ambil hash (misal "#/dashboard" -> "dashboard")
  let hash = window.location.hash.replace(/^#\/?/, '') || 'dashboard';
  
  // Fallback jika route tidak ada
  if (!routes[hash]) hash = 'dashboard';

  // Proteksi khusus: Hanya admin bisa akses pengaturan
  if (hash === 'pengaturan' && state.profile.role !== 'admin') {
    window.location.hash = '#/dashboard';
    return;
  }

  // 1. Update Active State di Sidebar
  navItems.forEach(el => {
    if (el.dataset.route === hash) el.classList.add('active');
    else el.classList.remove('active');
  });

  // 2. Tutup sidebar (kalau di mobile)
  closeSidebar();

  // 3. Render View
  try {
    // Tampilkan loading sementara
    view.innerHTML = `<div class="loading-state"><div class="spinner spinner-dark"></div> Memuat…</div>`;
    
    // Panggil fungsi render sesuai rute
    await routes[hash]();
  } catch (err) {
    console.error(`Error rendering ${hash}:`, err);
    view.innerHTML = `<div class="login-error">Terjadi kesalahan saat memuat halaman. Cek Console.</div>`;
  }
}

/* =========================================================
   3. RENDER FUNCTIONS (PLACEHOLDER)
   ========================================================= */
async function renderDashboard() {
  view.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; border:1px solid var(--gray-200); text-align:center; margin-top:20px;">
      <h2 style="color:var(--green-700);">🚧 Modul Dashboard</h2>
      <p style="color:var(--gray-500);">Grafik dan ringkasan pelayanan akan tampil di sini (Fase 5).</p>
    </div>
  `;
}

async function renderInput() {
  view.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; border:1px solid var(--gray-200); text-align:center; margin-top:20px;">
      <h2 style="color:var(--green-700);">🚧 Modul Input Laporan</h2>
      <p style="color:var(--gray-500);">Form input dinamis sesuai ruangan akan tampil di sini (Fase 4).</p>
    </div>
  `;
}

async function renderStaff() {
  view.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; border:1px solid var(--gray-200); text-align:center; margin-top:20px;">
      <h2 style="color:var(--green-700);">🚧 Modul Daftar Staff</h2>
      <p style="color:var(--gray-500);">Manajemen dan daftar staff akan tampil di sini (Fase 6).</p>
    </div>
  `;
}

async function renderPengaturan() {
  view.innerHTML = `
    <div style="background:#fff; padding:24px; border-radius:12px; border:1px solid var(--gray-200); text-align:center; margin-top:20px;">
      <h2 style="color:var(--green-700);">🚧 Modul Pengaturan Admin</h2>
      <p style="color:var(--gray-500);">Pengaturan ruangan, staff, dan user akan tampil di sini (Fase 6).</p>
    </div>
  `;
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
// Jangan lupa minta halaman memuat route pertama kali

/* =========================================================
   5. START APP
   ========================================================= */
(async () => {
  const ok = await initAuth();
  if (ok) {
    // Kalau belum ada hash, arahkan ke dashboard
    if (!window.location.hash) window.location.hash = '#/dashboard';
    handleRoute(); 
  }
})();
