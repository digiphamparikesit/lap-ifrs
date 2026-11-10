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
  
  // Render Kerangka Form
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
      // Gunakan CSS Grid 4 Kolom untuk form yang padat
      formHTML += `<div class="form-section" style="grid-column: 1 / -1;"><h3 class="section-title">${grup}</h3><div class="section-body compact-grid">`;
      
      template.fields.forEach(f => {
        if (f.group !== grup) return;

        // Field teks panjang (Petugas & Obat) ambil 1 baris penuh
        const isFullWidth = (f.type === 'petugas' || f.id === 'obat_tidak_terlayani') ? 'span-4' : '';

        if (f.type === 'petugas') {
          formHTML += `
            <div class="form-group ${isFullWidth}">
              <label>${f.label} <span class="required">*</span> <small style="font-weight:normal; color:var(--gray-500);">(Centang staff yang bertugas)</small></label>
              <div id="petugas-container" class="petugas-checklist-wrap">
                <!-- Daftar checkbox akan dimuat di sini oleh JS -->
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

        formHTML += `
          <div class="form-group ${isFullWidth}">
            <label for="field-${f.id}">${f.label}${reqStar}</label>
            ${inputHTML}
          </div>
        `;
      });
      formHTML += `</div></div>`;
    });

    dynamicContainer.innerHTML = formHTML;

    // Ambil daftar staff
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

    // Inisialisasi Checklist Petugas
    initPetugasChecklist(daftarStaff);
    
    // Pasang event listener submit
    const formEl = document.getElementById('form-laporan');
    formEl.onsubmit = (e) => {
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
   2. LOGIKA CHECKLIST PETUGAS (Multi-Select)
   ========================================================= */
function initPetugasChecklist(daftarStaff) {
  const container = document.getElementById('petugas-container');
  const hiddenInput = document.getElementById('field-petugas');
  
  let selected = []; // array id staff terpilih

  if (!daftarStaff || daftarStaff.length === 0) {
    container.innerHTML = `<div style="color:var(--gray-500); font-size:0.9rem;">Tidak ada data staff untuk ruangan ini.</div>`;
    return;
  }

  // Urutkan nama staff sesuai abjad
  daftarStaff.sort((a, b) => a.nama.localeCompare(b.nama));

  // Render checkbox untuk setiap staff
  let html = `<div class="checkbox-list">`;
  daftarStaff.forEach(staff => {
    html += `
      <label class="checkbox-item">
        <input type="checkbox" class="staff-checkbox" value="${staff.id}" data-nama="${staff.nama}">
        <span class="checkbox-name">${staff.nama}</span>
      </label>
    `;
  });
  html += `</div>`;
  container.innerHTML = html;

  // Event listener saat checkbox dicentang/dihapus centangnya
  container.querySelectorAll('.staff-checkbox').forEach(cb => {
    cb.addEventListener('change', () => {
      if (cb.checked) {
        if (!selected.includes(cb.value)) selected.push(cb.value);
        cb.closest('.checkbox-item').classList.add('checked');
      } else {
        selected = selected.filter(id => id !== cb.value);
        cb.closest('.checkbox-item').classList.remove('checked');
      }
      hiddenInput.value = selected.join(',');
    });
  });
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
    
    // Reset form
    document.getElementById('field-petugas').value = '';
    // Uncheck semua checkbox
    document.querySelectorAll('.staff-checkbox').forEach(cb => {
      cb.checked = false;
      cb.closest('.checkbox-item').classList.remove('checked');
    });
    
    // Reset angka
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
