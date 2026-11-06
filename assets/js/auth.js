// assets/js/auth.js
// Logika login PIN ruangan → Supabase Auth.

import { supabase } from './supabase.js';

const selectRuangan = document.getElementById('ruangan');
const inputPin     = document.getElementById('pin');
const btnLogin     = document.getElementById('btn-login');
const form         = document.getElementById('login-form');
const errBox       = document.getElementById('login-error');
const btnTogglePin = document.getElementById('toggle-pin');

/* ---------------- util ---------------- */
function showError(msg) {
  errBox.textContent = msg;
  errBox.hidden = false;
}
function clearError() { errBox.hidden = true; errBox.textContent = ''; }
function setLoading(on, text = 'Masuk') {
  btnLogin.disabled = on;
  btnLogin.innerHTML = on
    ? `<span class="spinner"></span>Memproses…`
    : text;
}

/* ---------------- toggle PIN ---------------- */
btnTogglePin.addEventListener('click', () => {
  const isPwd = inputPin.type === 'password';
  inputPin.type = isPwd ? 'text' : 'password';
  btnTogglePin.textContent = isPwd ? '🙈' : '👁';
  inputPin.focus();
});

/* ---------------- muat daftar ruangan ---------------- */
async function loadRuangan() {
  const { data, error } = await supabase
    .from('ruangan')
    .select('id, kode, nama, email_auth')
    .eq('aktif', true)
    .order('kode');

  if (error) {
    selectRuangan.innerHTML = `<option value="">Gagal memuat ruangan</option>`;
    showError('Gagal memuat daftar ruangan. Cek koneksi.');
    console.error(error);
    return;
  }

  selectRuangan.innerHTML =
    `<option value="">— Pilih Ruangan —</option>` +
    data.map(r =>
      `<option value="${r.id}" data-email="${r.email_auth}">${r.nama}</option>`
    ).join('');
}

/* ---------------- submit login ---------------- */
form.addEventListener('submit', async (e) => {
  e.preventDefault();
  clearError();

  const opt = selectRuangan.selectedOptions[0];
  const ruanganId = selectRuangan.value;
  const email     = opt?.dataset?.email;
  const pin       = inputPin.value.trim();

  if (!ruanganId) return showError('Silakan pilih ruangan terlebih dahulu.');
  if (!pin)       return showError('PIN tidak boleh kosong.');

  setLoading(true);

  const { error } = await supabase.auth.signInWithPassword({
    email,
    password: pin,
  });

  if (error) {
    setLoading(false);
    // Pesan generik — jangan bocorkan detail
    if (error.message?.toLowerCase().includes('invalid')) {
      showError('PIN salah. Silakan coba lagi.');
    } else {
      showError('Login gagal: ' + error.message);
    }
    inputPin.value = '';
    inputPin.focus();
    return;
  }

  // sukses → redirect
  window.location.replace('app.html');
});

/* ---------------- init ---------------- */
(async () => {
  // kalau sudah login, langsung ke app
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.replace('app.html');
    return;
  }
  await loadRuangan();
})();
