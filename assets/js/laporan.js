// assets/js/laporan.js
import { supabase } from './supabase.js';
import { getTemplate, getGroups } from './templates.js';

/* =========================================================
   1. RENDER FORM DINAMIS
   ========================================================= */
export async function renderFormInput(container, state) {
  const isAdmin = state.profile.role === 'admin';
  
  container.innerHTML = `<div class="loading-state"><div class="spinner spinner-dark"></div> Memuat form…</div>`;

  let listRuangan = [];
  if (isAdmin) {
    const { data } = await supabase.from('ruangan').select('id, nama, template_key').neq('kode', 'ADMIN').order('kode');
    listRuangan = data || [];
  }

  const defaultTemplateKey = isAdmin ? (listRuangan[0]?.template_key || 'igd') : state.ruangan?.template_key;
  
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

  const drawFields = async (templateKey) => {
    const template = getTemplate(templateKey);
    const groups = getGroups(templateKey);
    const dynamicContainer = document.getElementById('dynamic-form-fields');
    
    let formHTML = `<div class="form-layout-2col">`; // Pembungkus 2 Kolom Utama

    // Kelompokkan field menjadi Kiri (0) dan Kanan (1)
    let colIndex = 0;
    let currentGroupHTML = '';

    groups.forEach(grup => {
      // Cek apakah ini grup 'Umum' agar lebarnya penuh (span 2 kolom)
      const isFullWidthGroup = grup.toLowerCase() === 'umum' || grup.toLowerCase() === 'identitas';
      
      let groupHTML = `<div class="form-section ${isFullWidthGroup ? 'full-span' : ''}">`;
      groupHTML += `<h3 class="section-title">${grup}</h3>`;
      // Form input kita gunakan grid 4 kolom yang padat
      groupHTML += `<div class="section-body compact-grid">`;

      template.fields.forEach(f => {
        if (f.group !== grup) return;

        const isFullWidth = (f.type === 'petugas' || f.id === 'obat_tidak_terlayani') ? 'span-4' : '';

        if (f.type === 'petugas') {
          groupHTML += `
            <div class="form-group span-4">
              <label>${f.label} <span class="required">*</span></label>
              <div id="petugas-container" class="petugas-checklist-wrap" style="position:relative;">
                <button type="button" id="btn-dropdown-petugas" class="form-control" style="text-align:left; background:#fff; cursor:pointer; display:flex; justify-content:space-between; align-items:center;">
                  <span id="petugas-label-terpilih" style="color:var(--gray-500);">— Pilih Petugas —</span>
                  <span style="font-size:0.8rem;">▼</span>
                </button>
                <div id="dropdown-petugas" class="petugas-dropdown-menu" hidden>
                  <div style="padding:8px; border-bottom:1px solid var(--gray-200); background:var(--gray-50);">
                    <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:bold; color:var(--green-700);">
                      <input type="checkbox" id="check-all-petugas" style="width:16px; height:16px;"> Centang Semua
                    </label>
                  </div>
                  <div id="petugas-list-container" class="checkbox-list" style="padding:8px;">
                    <!-- Render JS -->
                  </div>
                </div>
              </div>
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
          inputHTML = `<select id="field-${f.id}" name="${f.id}" ${req} class="form-control"><option value="">— Pilih —</option>${opts}</select>`;
        } else {
          let defVal = '';
          if (f.type === 'date') defVal = new Date().toISOString().split('T')[0];
          inputHTML = `<input type="${f.type}" id="field-${f.id}" name="${f.id}" value="${defVal}" ${req} ${f.min !== undefined ? `min="${f.min}"` : ''} class="form-control" />`;
        }

        groupHTML += `
          <div class="form-group ${isFullWidth}">
            <label for="field-${f.id}">${f.label}${reqStar}</label>
            ${inputHTML}
          </div>
        `;
      });
      groupHTML += `</div></div>`;

      // LOGIKA PEMBAGIAN KOLOM
      if (isFullWidthGroup) {
        // Jika Grup Umum, paksa masuk ke kolom 1 (kiri) dan penuhi 2 kolom
        formHTML += `<div class="full-span">${groupHTML}</div>`;
      } else {
        // Jika grup lain, masukkan ke Kiri atau Kanan secara bergantian
        if (colIndex === 0) {
          formHTML += `<div class="col-left">${groupHTML}</div>`;
          colIndex = 1;
        } else {
          // Jika kolom kanan sudah ada isinya, tutup dan buka pembungkus baru
          if (formHTML.includes('col-right')) {
            formHTML += `<div class="col-left">${groupHTML}</div>`;
          } else {
            formHTML += `<div class="col-right">${groupHTML}</div>`;
          }
        }
      }
    });
    formHTML += `</div>`;

    dynamicContainer.innerHTML = formHTML;

    // Ambil staff & inisialisasi dropdown
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

    initPetugasChecklist(daftarStaff);
    
    const formEl = document.getElementById('form-laporan');
    formEl.onsubmit = (e) => {
      const rId = isAdmin ? listRuangan.find(ru => ru.template_key === templateKey)?.id : state.profile.ruangan_id;
      handleSubmit(e, template, state, rId);
    };
  };

  await drawFields(defaultTemplateKey);

  if (isAdmin) {
    document.getElementById('admin-select-ruangan').addEventListener('change', async (e) => {
      await drawFields(e.target.value);
    });
  }
}

/* =========================================================
   2. LOGIKA CHECKLIST PETUGAS (Dropdown & Centang Semua)
   ========================================================= */
function initPetugasChecklist(daftarStaff) {
  const btnDropdown = document.getElementById('btn-dropdown-petugas');
  const menu = document.getElementById('dropdown-petugas');
  const listContainer = document.getElementById('petugas-list-container');
  const label = document.getElementById('petugas-label-terpilih');
  const hiddenInput = document.getElementById('field-petugas');
  const checkAll = document.getElementById('check-all-petugas');
  
  let selected = [];

  // Render List Checkbox
  if (daftarStaff.length === 0) {
    listContainer.innerHTML = `<div style="padding:8px; font-size:0.9rem; color:var(--gray-500);">Tidak ada data staff.</div>`;
  } else {
    daftarStaff.sort((a, b) => a.nama.localeCompare(b.nama));
    listContainer.innerHTML = daftarStaff.map(staff => `
      <label class="checkbox-item" style="margin-bottom:4px; border:none; background:transparent; padding:6px 8px;">
        <input type="checkbox" class="staff-checkbox" value="${staff.id}" data-nama="${staff.nama}">
        <span class="checkbox-name">${staff.nama}</span>
      </label>
    `).join('');
  }

  // Buka/Tutup Dropdown
  btnDropdown.addEventListener('click', (e) => {
    e.preventDefault();
    menu.hidden = !menu.hidden;
  });

  // Tutup dropdown jika klik di luar
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#petugas-container')) menu.hidden = true;
  });

  // Event saat checklist individu diubah
  const checkboxes = listContainer.querySelectorAll('.staff-checkbox');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.value;
      if (cb.checked) {
        if (!selected.includes(id)) selected.push(id);
        cb.closest('.checkbox-item').style.background = 'var(--green-50)';
      } else {
        selected = selected.filter(x => x !== id);
        cb.closest('.checkbox-item').style.background = 'transparent';
      }
      updateUI();
    });
  });

  // Event CENTANG SEMUA
  checkAll.addEventListener('change', () => {
    checkboxes.forEach(cb => {
      cb.checked = checkAll.checked;
      const id = cb.value;
      if (checkAll.checked) {
        if (!selected.includes(id)) selected.push(id);
        cb.closest('.checkbox-item').style.background = 'var(--green-50)';
      } else {
        selected = selected.filter(x => x !== id);
        cb.closest('.checkbox-item').style.background = 'transparent';
      }
    });
    updateUI();
  });

  // Update Label & Hidden Input
  function updateUI() {
    hiddenInput.value = selected.join(',');
    
    if (selected.length === 0) {
      label.textContent = '— Pilih Petugas —';
      label.style.color = 'var(--gray-500)';
    } else if (selected.length === daftarStaff.length) {
      label.textContent = 'Semua Petugas Terpilih';
      label.style.color = 'var(--green-700)';
      label.style.fontWeight = 'bold';
    } else {
      label.textContent = `${selected.length} Petugas Terpilih`;
      label.style.color = 'var(--green-700)';
      label.style.fontWeight = 'bold';
    }

    // Reset "Centang Semua" jika tidak semua terpilih
    checkAll.checked = selected.length === daftarStaff.length && daftarStaff.length > 0;
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

    const { error } = await supabase.from('laporan').upsert(payload, { onConflict: 'ruangan_id, tanggal, shift' });
    if (error) throw error;

    alert('✅ Laporan berhasil disimpan!');
    
    // Reset Form
    document.getElementById('field-petugas').value = '';
    document.getElementById('petugas-label-terpilih').textContent = '— Pilih Petugas —';
    document.getElementById('petugas-label-terpilih').style.color = 'var(--gray-500)';
    document.querySelectorAll('.staff-checkbox').forEach(cb => { cb.checked = false; cb.closest('.checkbox-item').style.background = 'transparent'; });
    document.getElementById('check-all-petugas').checked = false;
    
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
