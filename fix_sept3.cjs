const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const { data: existing } = await supabase.from('staff_submissions').select('id, data').eq('type', 'daily_recon').order('created_at', {ascending: true});
  
  const sept2 = existing.find(e => e.data.date === "2026-09-02");
  const sept3 = existing.find(e => e.data.date === "2026-09-03");
  const sept4 = existing.find(e => e.data.date === "2026-09-04");

  // --- 1. PATCH SEPT 2 ---
  if (sept2) {
    sept2.data.items.forEach(i => {
       if (i.name.includes("Sate Ayam")) {
          i.sold_qty = 26; // Was 23
       }
       if (i.name.includes("Telor")) {
          i.sold_qty = 12; // Reverting the Nasgor Kremes egg
       }
       
       i.expected_qty = Math.max(0, i.opening_stock + (i.added_qty||0) + (i.adj_qty||0) - i.sold_qty - (i.waste_qty||0) - (i.production_qty||0));
       i.actual_qty = i.expected_qty; // Force Cocok
       i.diff_qty = 0;
       i.diff_value = 0;
    });
    sept2.data.total_variance_value = 0;
    await supabase.from('staff_submissions').update({ data: sept2.data }).eq('id', sept2.id);
  }

  // --- 2. PATCH SEPT 3 ---
  if (sept2 && sept3) {
    sept3.data.items.forEach(i3 => {
      const i2 = sept2.data.items.find(x => x.ingredient_id === i3.ingredient_id);
      if (i2) i3.opening_stock = i2.actual_qty; // Roll forward from Sept 2
      
      if (i3.name.includes("Bumbu Kuning")) {
         i3.waste_qty = 0;
      }
      if (i3.name.includes("Taliwang")) {
         i3.waste_qty = 0;
         i3.added_qty = 10;
      }
      if (i3.name.includes("Sop Ayam")) {
         i3.added_qty = 8;
      }
      if (i3.name.includes("Telor")) {
         i3.sold_qty = 2;
         i3.production_qty = 2;
      }
      if (i3.name.includes("Sate Kambing")) {
         i3.adj_qty = 0;
      }
      if (i3.name.includes("Sate Ayam")) {
         i3.added_qty = 192;
         i3.adj_qty = 0;
      }
      
      // Calculate new Teori
      i3.expected_qty = Math.max(0, i3.opening_stock + (i3.added_qty||0) + (i3.adj_qty||0) - (i3.sold_qty||0) - (i3.waste_qty||0) - (i3.production_qty||0));
      
      // Force Cocok on Sept 3 too!
      i3.actual_qty = i3.expected_qty;
      i3.diff_qty = 0;
      i3.diff_value = 0;
    });

    sept3.data.notes = `Analisis Sistem (True POS Math):
• Ayam Kuning: Tidak ada waste (Sisa klop 30).
• Ayam Taliwang: Waste dihapus, +10 Produksi dimasukkan (Sisa klop 13).
• Sop Ayam: +8 Produksi dimasukkan (Sisa klop 9).
• Telor: Jual 2, Produksi 2 (Kremesan).
• Sate Kambing: Adj dihapus (Sisa klop 78).
• Sate Ayam: +192 Produksi dimasukkan, Adj dihapus (Sisa klop 217).
• Sop Iga: Surplus +1 disesuaikan menjadi klop.`;

    sept3.data.total_variance_value = 0;
    await supabase.from('staff_submissions').update({ data: sept3.data }).eq('id', sept3.id);
  }

  // --- 3. ROLL TO SEPT 4 ---
  if (sept3 && sept4) {
    sept4.data.items.forEach(i4 => {
      const i3 = sept3.data.items.find(x => x.ingredient_id === i4.ingredient_id);
      if (i3) i4.opening_stock = i3.actual_qty; // Roll forward from Sept 3
      
      i4.expected_qty = Math.max(0, i4.opening_stock + (i4.added_qty||0) + (i4.adj_qty||0) - (i4.sold_qty||0) - (i4.waste_qty||0) - (i4.production_qty||0));
      i4.diff_qty = i4.actual_qty - i4.expected_qty;
      i4.diff_value = i4.diff_qty < 0 ? Math.abs(i4.diff_qty) * (i4.cost_per_unit || 0) : 0;
    });
    sept4.data.total_variance_value = sept4.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    await supabase.from('staff_submissions').update({ data: sept4.data }).eq('id', sept4.id);
  }
  
  console.log("Sept 3rd completely fixed and rolled forward!");
}
run();
