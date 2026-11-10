const fs = require('fs');
const csv = require('csv-parser');
const { createClient } = require('@supabase/supabase-js');

// 1. KONFIGURASI
const SUPABASE_URL = 'URL_SUPABASE_ANDA';
const SUPABASE_SERVICE_KEY = 'SERVICE_ROLE_KEY_ANDA'; // Gunakan service key agar bisa bypass RLS saat migrasi
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

// 2. TENTUKAN RUANGAN & FILE CSV
const RUANGAN_ID = 'MASUKKAN_ID_RUANGAN_DARI_SUPABASE'; // Cek di tabel ruangan
const NAMA_FILE_CSV = 'igd.csv'; // Ganti sesuai nama file CSV Anda
const PUNYA_SHIFT = true; // true jika ruangan ini pakai shift (IGD, IBS, dll)

const results = [];

fs.createReadStream(NAMA_FILE_CSV)
  .pipe(csv())
  .on('data', (data) => {
    // --- PROSES MIGRASI DATA ---
    // Kita petakan header Excel ke format JSON aplikasi kita
    
    // 1. Ambil Tanggal
    let tanggalStr = data['TANGGAL INPUT LAPORAN'] || data['TANGGAL INPUT LAPORAN IBS'];
    let tanggal = null;
    if (tanggalStr) {
      // Excel biasanya format DD/MM/YYYY atau YYYY-MM-DD
      const parts = tanggalStr.split(' ')[0].split('/'); 
      if(parts.length === 3) {
        tanggal = `${parts[2]}-${parts[1]}-${parts[0]}`; // Ubah ke YYYY-MM-DD
      } else {
        tanggal = tanggalStr.split(' ')[0]; 
      }
    }

    // 2. Ambil Shift (Jika ada)
    let shift = data['JADWAL SHIFT'] ? data['JADWAL SHIFT'].toLowerCase() : null;
    if (shift === 'siang' || shift === 'middle') shift = 'middle';
    if (shift === 'malam') shift = 'sore';

    // 3. Ambil Petugas (Gabungkan Petugas 1-19 menjadi Array)
    let petugasNames = [];
    for (let i = 1; i <= 19; i++) {
      let nama = data[`PETUGAS ${i}`] || data[`NAMA PETUGAS IGD ${i}`] || data[`PETUGAS PAGI ${i}`] || data[`PETUGAS MIDEL ${i}`];
      if (nama && nama.trim() !== '') petugasNames.push(nama.trim());
    }
    // Catatan: Di aplikasi kita, petugas disimpan sebagai UUID. 
    // Untuk migrasi cepat, kita bisa biarkan kosong dulu, atau Anda harus mencocokkan nama ke tabel staff.

    // 4. Kumpulkan Data Angka (Sisanya)
    const dataPayload = {};
    for (const [key, value] of Object.entries(data)) {
      // Abaikan kolom non-angka
      if (['TANGGAL INPUT LAPORAN', 'TANGGAL INPUT LAPORAN IBS', 'JADWAL SHIFT', 'BULAN', 'TAHUN'].includes(key)) continue;
      if (key.startsWith('PETUGAS') || key.startsWith('NAMA PETUGAS')) continue;
      
      // Ubah nama header menjadi id field di aplikasi kita (huruf kecil, spasi jadi underscore)
      const fieldId = key.toLowerCase().replace(/[^a-z0-9]/g, '_').replace(/_+/g, '_');
      
      // Konversi ke angka jika memungkinkan
      const numVal = parseFloat(value);
      dataPayload[fieldId] = isNaN(numVal) ? value : numVal;
    }

    // Masukkan ke array untuk di-insert
    results.push({
      ruangan_id: RUANGAN_ID,
      tanggal: tanggal,
      shift: PUNYA_SHIFT ? shift : null,
      petugas_ids: [], // Kosongkan dulu, atau isi jika Anda punya script pencocokan nama
      data: dataPayload
    });
  })
  .on('end', async () => {
    console.log(`Mencoba memasukkan ${results.length} data...`);
    
    // Insert ke Supabase (dibagi per 100 baris agar tidak timeout)
    for (let i = 0; i < results.length; i += 100) {
      const chunk = results.slice(i, i + 100);
      const { data, error } = await supabase.from('laporan').insert(chunk);
      
      if (error) {
        console.error('Gagal migrasi chunk:', error);
      } else {
        console.log(`✅ Berhasil memasukkan baris ${i + 1} - ${i + chunk.length}`);
      }
    }
    console.log('Migrasi Selesai!');
  });
