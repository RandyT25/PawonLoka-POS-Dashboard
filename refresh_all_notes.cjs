const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const { data: existing, error } = await supabase.from("staff_submissions").select("id, data").eq("type", "daily_recon");
  if (error) return console.error(error);
  
  const sept1 = existing.find(e => e.data.date === "2026-09-01");
  const sept2 = existing.find(e => e.data.date === "2026-09-02");
  const sept3 = existing.find(e => e.data.date === "2026-09-03");
  const sept4 = existing.find(e => e.data.date === "2026-09-04");

  if (sept1) {
    sept1.data.notes = `Analisis Sistem (Final Audit):
• Ayam Taliwang: Terjual total 2 porsi (1 kasir + 1 via Gojek yang tidak terinput). Selisih 0.
• Telor (-45 Selisih): Hilang 45 butir sejak setup awal bulan. 
• Sate Kambing (-146 Selisih) & Sate Ayam (-70 Selisih): Penyesuaian besar-besaran karena stok fisik awal bulan sangat jauh dari data POS lama.
• Sop Iga (-15 Selisih): Koreksi ke stok riil awal bulan.`;
    await supabase.from("staff_submissions").update({ data: sept1.data }).eq("id", sept1.id);
  }

  if (sept2) {
    sept2.data.notes = `Analisis Sistem (Final Audit):
Semua surplus/minus ilusi telah dikoreksi menjadi ✓ Cocok dengan fakta lapangan berikut:
• Ayam Bumbu Kuning: Total 8 terjual (termasuk pesanan Gojek).
• Ayam Taliwang & Sate Ayam: Kontaminasi salah hitung dihapus (produksi milik tgl 3 tidak lagi dihitung di tgl 2).
• Sop Ayam: Total 2 terjual via Gojek. Fisik klop 1 porsi.
• Telor: Total 13 terjual (tambahan 1 untuk Nasgor Kambing). Input PO 105 dibatalkan karena fisik Awal 150 sudah termasuk PO tersebut.
• Sate Kambing: -6 tusuk tercover oleh 1 Tongseng & 1 Nasgor Kambing via Gojek (Total Jual 27).`;
    await supabase.from("staff_submissions").update({ data: sept2.data }).eq("id", sept2.id);
  }

  if (sept3) {
    sept3.data.notes = `Analisis Sistem (Final Audit):
Seluruh stok hari ini melanjutkan angka riil dari tgl 2. Semua item ✓ Cocok:
• Ayam Bumbu Kuning: Terjual 2 porsi, sisa klop 30. (Waste dibatalkan).
• Ayam Taliwang: +10 Produksi resmi dimasukkan, sisa klop 13 porsi.
• Sop Ayam: +8 Produksi resmi dimasukkan, sisa klop 9 porsi.
• Telor: Terpakai 4 butir (2 Jual + 2 Produksi Adonan Kremesan). Sisa klop 133.
• Sate Kambing: Terjual 14 porsi, sisa klop 78.
• Sate Ayam: +192 Produksi resmi dimasukkan. Sisa klop 217.`;
    await supabase.from("staff_submissions").update({ data: sept3.data }).eq("id", sept3.id);
  }

  if (sept4) {
    sept4.data.notes = `Analisis Sistem (Final Audit):
• Sop Ayam (+1 Surplus): Tidak ada penjualan. Sisa Teori 9 tapi Fisik 10 (kemungkinan ada 1 porsi produksi tambahan yang lupa diinput).
• Telor (-2 Selisih): Terjual 14 butir. Sisa Teori 119 tapi Fisik 117. Kemungkinan terpakai untuk staff meal.
• Sate Kambing: Terjual 5 porsi. Ditambah +305 tusuk baru, fisik klop 378.
• Ayam Bumbu Kuning & Ayam Taliwang: Penjualan tercatat sempurna, fisik ✓ Cocok.`;
    await supabase.from("staff_submissions").update({ data: sept4.data }).eq("id", sept4.id);
  }

  console.log("All notes refreshed to clean final summaries!");
}
run();
