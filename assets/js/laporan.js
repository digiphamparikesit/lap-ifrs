// assets/js/laporan.js
import { supabase } from './supabase.js';
import { getTemplate, getGroups } from './templates.js';

/* =========================================================
   1. RENDER FORM DINAMIS
   ========================================================= */
// Perhatikan tambahan parameter (state) di sini
export async function renderFormInput(container, state) {
  const t = state.ruangan?.template_key;
  if (!t) {
    container.innerHTML = `<div class="login-error">Template ruangan tidak ditemukan.</div>`;
    return;
  }

  const template = getTemplate(t);
  const groups = getGroups(t);

  // Tampilkan loading
  container.innerHTML = `<div class="loading-state"><div class="spinner spinner-dark"></div> Memuat form…</div>`;

  let daftarStaff = [];

  try {
    // Ambil staff yang terdaftar di ruangan ini (untuk user biasa)
    if (state.profile.role === 'admin') {
      const { data } = await supabase.from('staff').select('id, nama').eq('aktif', true);
      daftarStaff = data || [];
    } else {
      // Ambil ruangan_id dari profile (lebih aman daripada state.ruangan.id)
      const rId = state.profile.ruangan_id; 
      
      const { data, error } = await supabase
        .from('staff_ruangan')
        .select('staff(id, nama)')
        .eq('ruangan_id', rId);
        
      if (error) throw error;
      daftarStaff = (data || []).map(s => s.staff).filter(Boolean);
    }
  } catch (err) {
    console.error("Gagal load staff:", err);
    container.innerHTML = `<div class="login-error">Gagal memuat data staff: ${err.message}</div>`;
    return;
  }

  // Generate HTML Form
  let formHTML = `<form id="form-laporan" class="form-laporan">`;
  
  // Render per grup
  groups.forEach(grup => {
    formHTML += `<div class="form-section"><h3 class="section-title">${grup}</h3><div class="section-body">`;
    
    template.fields.forEach(f => {
      if (f.group !== grup) return;

      // Khusus field Petugas (Custom Searchable Checklist)
      if (f.type === 'petugas') {
        formHTML += `
          <div class="form-group full-width">
            <label>${f.label} <span class="required">*</span></label>
            <div class="search-petugas-wrap">
              <input type="text" id="search-petugas" placeholder="Ketik nama petugas…" autocomplete="off" />
              <div id="hasil-petugas" class="dropdown-petugas" hidden></div>
            </div>
            <div id="selected-petugas" class="selected-petugas-list"></div>
            <input type="hidden" id="field-petugas" required />
          </div>
        `;
        return;
      }

      // Render field biasa (number, date, time, select)
      let inputHTML = '';
      const req = f.required ? 'required' : '';
      const reqStar = f.required ? ' <span class="required">*</span>' : '';

      if (f.type === 'select') {
        const opts = f.opsi.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
        inputHTML = `<select id="field-${f.id}" name="${f.id}" ${req}><option value="">— Pilih —</option>${opts}</select>`;
      } else {
        // Isi default tanggal dengan hari ini
        let defVal = '';
        if (f.type === 'date') {
          defVal = new Date().toISOString().split('T')[0];
        }
        inputHTML = `<input type="${f.type}" id="field-${f.id}" name="${f.id}" value="${defVal}" ${req} ${f.min !== undefined ? `min="${f.min}"` : ''} />`;
      }

      formHTML += `
        <div class="form-group">
          <label for="field-${f.id}">${f.label}${reqStar}</label>
          ${inputHTML}
        </div>
      `;
    });
    
    formHTML += `</div></div>`; // end section
  });

  formHTML += `
    <div class="form-actions">
      <button type="submit" class="btn-primary" id="btn-simpan">Simpan Laporan</button>
    </div>
  </form>`;

  container.innerHTML = formHTML;

  // Init Custom Petugas Component
  initPetugasSearch(daftarStaff);

  // Handle Submit
  document.getElementById('form-laporan').addEventListener('submit', (e) => handleSubmit(e, template, state));
}

/* =========================================================
   2. LOGIKA PENCARIAN & PILIH PETUGAS
   ========================================================= */
function initPetugasSearch(daftarStaff) {
  const input = document.getElementById('search-petugas');
  const dropdown = document.getElementById('hasil-petugas');
  const selectedList = document.getElementById('selected-petugas');
  const hiddenInput = document.getElementById('field-petugas');
  
  let selected = []; // array id staff terpilih

  input.addEventListener('input', (e) => {
    const q = e.target.value.toLowerCase();
    if (q.length < 2) { dropdown.hidden = true; return; }

    const hasil = daftarStaff.filter(s => 
      s.nama.toLowerCase().includes(q) && !selected.includes(s.id)
    );

    if (hasil.length === 0) {
      dropdown.innerHTML = `<div class="dropdown-item disabled">Tidak ada hasil</div>`;
    } else {
      dropdown.innerHTML = hasil.map(s => 
        `<div class="dropdown-item" data-id="${s.id}" data-nama="${s.nama}">${s.nama}</div>`
      ).join('');
    }
    dropdown.hidden = false;
  });

  // Klik hasil dropdown
  dropdown.addEventListener('click', (e) => {
    const item = e.target.closest('.dropdown-item');
    if (!item || item.classList.contains('disabled')) return;
    
    const id = item.dataset.id;
    const nama = item.dataset.nama;
    
    if (!selected.includes(id)) {
      selected.push(id);
      renderSelected();
    }
    
    input.value = '';
    dropdown.hidden = true;
    input.focus();
  });

  // Sembunyikan dropdown jika klik di luar
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.search-petugas-wrap')) dropdown.hidden = true;
  });

  // Render pill yang terpilih
  function renderSelected() {
    selectedList.innerHTML = selected.map(id => {
      const staff = daftarStaff.find(s => s.id === id);
      if(!staff) return '';
      return `
        <div class="pill">
          ${staff.nama}
          <button type="button" class="pill-remove" data-id="${id}">×</button>
        </div>
      `;
    }).join('');
    
    hiddenInput.value = selected.join(',');
    
    // Event hapus
    selectedList.querySelectorAll('.pill-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const remId = e.target.dataset.id;
        selected = selected.filter(id => id !== remId);
        renderSelected();
      });
    });
  }
}

/* =========================================================
   3. PROSES SIMPAN LAPORAN
   ========================================================= */
async function handleSubmit(e, template, state) {
  e.preventDefault();
  const btn = document.getElementById('btn-simpan');
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner"></span> Menyimpan…`;

  try {
    const formData = new FormData(e.target);
    const dataPayload = {};
    
    let tanggal = null;
    let shift = null;
    let petugasIds = [];

    template.fields.forEach(f => {
      const val = formData.get(f.id);
      
      if (f.type === 'petugas') {
        petugasIds = document.getElementById('field-petugas').value.split(',').filter(x => x);
      } else if (f.id === 'tanggal') {
        tanggal = val;
      } else if (f.id === 'shift') {
        shift = val;
        dataPayload[f.id] = val;
      } else {
        // Konversi ke angka jika tipe number
        dataPayload[f.id] = f.type === 'number' ? (parseInt(val) || 0) : val;
      }
    });

    if (petugasIds.length === 0) throw new Error("Pilih minimal 1 petugas.");
    if (!tanggal) throw new Error("Tanggal harus diisi.");

    const rId = state.ruangan?.id || state.profile?.ruangan_id;

    const payload = {
      ruangan_id: rId,
      tanggal: tanggal,
      shift: shift || null,
      petugas_ids: petugasIds,
      data: dataPayload,
      created_by: (await supabase.auth.getUser()).data.user.id
    };

    // Simpan (Upsert)
    const { error } = await supabase
      .from('laporan')
      .upsert(payload, { onConflict: 'ruangan_id, tanggal, shift' });

    if (error) throw error;

    alert('✅ Laporan berhasil disimpan!');
    
    // Reset form (kecuali tanggal & shift)
    document.getElementById('selected-petugas').innerHTML = '';
    document.getElementById('field-petugas').value = '';
    template.fields.forEach(f => {
      if (f.type === 'number') document.getElementById(`field-${f.id}`).value = '';
    });

  } catch (err) {
    console.error(err);
    alert('❌ Gagal menyimpan: ' + err.message);
  } finally {
    btn.disabled = false;
    btn.textContent = 'Simpan Laporan';
  }
}
