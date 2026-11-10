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

  // Tambahkan Modal Dialog untuk Petugas di HTML
  container.innerHTML = `
    <form id="form-laporan" class="form-laporan">
      ${headerHTML}
      <div id="dynamic-form-fields"></div>
      <div class="form-actions">
        <button type="submit" class="btn-primary" id="btn-simpan">Simpan Laporan</button>
      </div>
    </form>

    <!-- Modal Checklist Petugas -->
    <dialog id="modal-petugas" class="modal-petugas">
      <div class="modal-header">
        <h3 style="margin:0; color:var(--green-800);">Pilih Petugas Bertugas</h3>
        <button type="button" id="btn-close-petugas" class="modal-close">×</button>
      </div>
      
      <div class="modal-toolbar">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; font-weight:bold; color:var(--green-700);">
          <input type="checkbox" id="check-all-petugas" style="width:18px; height:18px;"> Centang Semua
        </label>
        <span id="count-terpilih" style="font-size:0.85rem; color:var(--gray-500);">0 Terpilih</span>
      </div>

      <div id="petugas-modal-list" class="modal-body-grid">
        <!-- Checkbox list dimuat di sini -->
      </div>

      <div class="modal-footer">
        <button type="button" id="btn-selesai-petugas" class="btn-primary" style="width:auto; padding:10px 24px;">Selesai</button>
      </div>
    </dialog>
  `;

  const drawFields = async (templateKey) => {
    const template = getTemplate(templateKey);
    const groups = getGroups(templateKey);
    const dynamicContainer = document.getElementById('dynamic-form-fields');
    
    let formHTML = `<div class="form-layout-2col">`;

    let colIndex = 0;

    groups.forEach(grup => {
      const isFullWidthGroup = grup.toLowerCase() === 'umum' || grup.toLowerCase() === 'identitas';
      
      let groupHTML = `<div class="form-section ${isFullWidthGroup ? 'full-span' : ''}">`;
      groupHTML += `<h3 class="section-title">${grup}</h3>`;
      groupHTML += `<div class="section-body compact-grid">`;

      template.fields.forEach(f => {
        if (f.group !== grup) return;

        const isFullWidth = (f.type === 'petugas' || f.id === 'obat_tidak_terlayani') ? 'span-4' : '';

        if (f.type === 'petugas') {
          // Tampilan Tombol Pemicu Modal (Bukan Dropdown Biasa)
          groupHTML += `
            <div class="form-group span-4">
              <label>${f.label} <span class="required">*</span></label>
              <button type="button" id="btn-buka-modal-petugas" class="form-control btn-buka-petugas">
                <span id="petugas-label-terpilih" style="color:var(--gray-500);">— Klik untuk memilih petugas —</span>
                <span style="font-size:0.8rem; color:var(--green-600); font-weight:bold;">+ Pilih</span>
              </button>
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

      if (isFullWidthGroup) {
        formHTML += `<div class="full-span">${groupHTML}</div>`;
      } else {
        if (colIndex === 0) {
          formHTML += `<div class="col-left">${groupHTML}</div>`;
          colIndex = 1;
        } else {
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

    // Ambil staff & inisialisasi modal
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

    initPetugasModal(daftarStaff);
    
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
   2. LOGIKA MODAL CHECKLIST PETUGAS
   ========================================================= */
function initPetugasModal(daftarStaff) {
  const modal = document.getElementById('modal-petugas');
  const btnBuka = document.getElementById('btn-buka-modal-petugas');
  const btnClose = document.getElementById('btn-close-petugas');
  const btnSelesai = document.getElementById('btn-selesai-petugas');
  const modalList = document.getElementById('petugas-modal-list');
  const label = document.getElementById('petugas-label-terpilih');
  const hiddenInput = document.getElementById('field-petugas');
  const checkAll = document.getElementById('check-all-petugas');
  const countTerpilih = document.getElementById('count-terpilih');
  
  let selected = [];

  // Render Grid Checklist di dalam Modal
  if (daftarStaff.length === 0) {
    modalList.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:20px; color:var(--gray-500);">Tidak ada data staff untuk ruangan ini.</div>`;
  } else {
    daftarStaff.sort((a, b) => a.nama.localeCompare(b.nama));
    modalList.innerHTML = daftarStaff.map(staff => `
      <label class="checkbox-item">
        <input type="checkbox" class="staff-checkbox-modal" value="${staff.id}" data-nama="${staff.nama}">
        <span class="checkbox-name">${staff.nama}</span>
      </label>
    `).join('');
  }

  // Buka Modal
  btnBuka.addEventListener('click', () => {
    modal.showModal();
  });

  // Tutup Modal
  const closeModal = () => modal.close();
  btnClose.addEventListener('click', closeModal);
  btnSelesai.addEventListener('click', closeModal);

  // Event Centang Individu
  const checkboxes = modalList.querySelectorAll('.staff-checkbox-modal');
  checkboxes.forEach(cb => {
    cb.addEventListener('change', () => {
      const id = cb.value;
      if (cb.checked) {
        if (!selected.includes(id)) selected.push(id);
        cb.closest('.checkbox-item').classList.add('checked');
      } else {
        selected = selected.filter(x => x !== id);
        cb.closest('.checkbox-item').classList.remove('checked');
      }
      updateUI();
    });
  });

  // Event Centang Semua
  checkAll.addEventListener('change', () => {
    checkboxes.forEach(cb => {
      cb.checked = checkAll.checked;
      const id = cb.value;
      if (checkAll.checked) {
        if (!selected.includes(id)) selected.push(id);
        cb.closest('.checkbox-item').classList.add('checked');
      } else {
        selected = selected.filter(x => x !== id);
        cb.closest('.checkbox-item').classList.remove('checked');
      }
    });
    updateUI();
  });

  function updateUI() {
    hiddenInput.value = selected.join(',');
    countTerpilih.textContent = `${selected.length} Terpilih`;

    if (selected.length === 0) {
      label.textContent = '— Klik untuk memilih petugas —';
      label.style.color = 'var(--gray-500)';
      label.style.fontWeight = 'normal';
    } else if (selected.length === daftarStaff.length) {
      label.textContent = `Semua Petugas Terpilih (${selected.length})`;
      label.style.color = 'var(--green-700)';
      label.style.fontWeight = 'bold';
    } else {
      label.textContent = `${selected.length} Petugas Dipilih`;
      label.style.color = 'var(--green-700)';
      label.style.fontWeight = 'bold';
    }

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
    
    // Reset Form & Modal
    document.getElementById('field-petugas').value = '';
    document.getElementById('petugas-label-terpilih').textContent = '— Klik untuk memilih petugas —';
    document.getElementById('petugas-label-terpilih').style.color = 'var(--gray-500)';
    document.getElementById('petugas-label-terpilih').style.fontWeight = 'normal';
    
    document.querySelectorAll('.staff-checkbox-modal').forEach(cb => { 
      cb.checked = false; 
      cb.closest('.checkbox-item').classList.remove('checked'); 
    });
    document.getElementById('check-all-petugas').checked = false;
    document.getElementById('count-terpilih').textContent = `0 Terpilih`;
    
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
