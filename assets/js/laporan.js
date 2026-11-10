// assets/js/laporan.js
import { supabase } from './supabase.js';
import { getTemplate, getGroups } from './templates.js';

/* =========================================================
   1. RENDER FORM DINAMIS
   ========================================================= */
export async function renderFormInput(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  // Tampilkan loading
  container.innerHTML = `<div class="loading-state"><div class="spinner spinner-dark"></div> Memuat form…</div>`;

  // Jika Admin, ambil semua daftar ruangan (kecuali ADMIN)
  let listRuangan = [];
  if (isAdmin) {
    const { data } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');
    listRuangan = data || [];
  }

  // Tentukan template default
  const defaultTemplateKey = isAdmin ? (listRuangan[0]?.template_key || 'igd') : state.ruangan?.template_key;
  
  // Render Kerangka Form (termasuk dropdown khusus admin)
  let headerHTML = '';
  if (isAdmin) {
    const opts = listRuangan.map(r => `<option value="${r.template_key}">${r.nama}</option>`).join('');
    headerHTML = `
      <div class="form-group full-width" style="background:var(--green-50); padding:16px; border-radius:8px; margin-bottom:20px; border:1px solid var(--green-200);">
        <label style="color:var(--green-800); font-weight:bold;">Pilih Ruangan (Mode Admin)</label>
        <select id="admin-select-ruangan" class="form-control" style="margin-top:8px;">
          ${opts}
        </select>
      </div>
    `;
  }

  container.innerHTML = `
    <form id="form-laporan" class="form-laporan">
      ${headerHTML}
      <div id="dynamic-form-fields"></div>
      <div class="form-actions">
        <button type="submit" class="btn-primary" id="btn-simpan">Simpan Laporan</button>
      </div>
    </form>
  `;

  // Fungsi untuk menggambar field berdasarkan template yang dipilih
  const drawFields = async (templateKey) => {
    const template = getTemplate(templateKey);
    const groups = getGroups(templateKey);
    const dynamicContainer = document.getElementById('dynamic-form-fields');
    
    let formHTML = '';
    groups.forEach(grup => {
      formHTML += `<div class="form-section"><h3 class="section-title">${grup}</h3><div class="section-body">`;
      template.fields.forEach(f => {
        if (f.group !== grup) return;

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

        let inputHTML = '';
        const req = f.required ? 'required' : '';
        const reqStar = f.required ? ' <span class="required">*</span>' : '';

        if (f.type === 'select') {
          const opts = f.opsi.map(o => `<option value="${o.value}">${o.label}</option>`).join('');
          inputHTML = `<select id="field-${f.id}" name="${f.id}" ${req}><option value="">— Pilih —</option>${opts}</select>`;
        } else {
          let defVal = '';
          if (f.type === 'date') defVal = new Date().toISOString().split('T')[0];
          inputHTML = `<input type="${f.type}" id="field-${f.id}" name="${f.id}" value="${defVal}" ${req} ${f.min !== undefined ? `min="${f.min}"` : ''} />`;
        }

        formHTML += `
          <div class="form-group">
            <label for="field-${f.id}">${f.label}${reqStar}</label>
            ${inputHTML}
          </div>
        `;
      });
      formHTML += `</div></div>`;
    });

    dynamicContainer.innerHTML = formHTML;

    // Ambil daftar staff (jika admin, ambil staff untuk ruangan yang dipilih)
    let daftarStaff = [];
    if (isAdmin) {
      const r = listRuangan.find(ru => ru.template_key === templateKey);
      if (r) {
        const { data } = await supabase.from('staff_ruangan').select('staff(id, nama)').eq('ruangan_id', r.id);
        daftarStaff = (data || []).map(s => s.staff).filter(Boolean);
      }
    } else {
      const { data } = await supabase.from('staff_ruangan').select('staff(id, nama)').eq('ruangan_id', state.profile.ruangan_id);
      daftarStaff = (data || []).map(s => s.staff).filter(Boolean);
    }

    initPetugasSearch(daftarStaff);
    
    // Pasang event listener submit dengan template yang sesuai
    const formEl = document.getElementById('form-laporan');
    formEl.onsubmit = (e) => {
      // Cari ID ruangan asli jika admin, jika bukan pakai state ruangan
      const rId = isAdmin ? listRuangan.find(ru => ru.template_key === templateKey)?.id : state.profile.ruangan_id;
      handleSubmit(e, template, state, rId);
    };
  };

  // Gambar pertama kali
  await drawFields(defaultTemplateKey);

  // Jika admin, pasang event listener jika dropdown ruangan diganti
  if (isAdmin) {
    document.getElementById('admin-select-ruangan').addEventListener('change', async (e) => {
      await drawFields(e.target.value);
    });
  }
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
async function handleSubmit(e, template, state, finalRId) {
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

    const rId = finalRId || state.profile?.ruangan_id;

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
