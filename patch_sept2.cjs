const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  // 1. Delete the bad stock movements from Sept 2
  await supabase.from("stock_movements").delete().eq("date", "2026-09-02").eq("ingredient_id", "ING-183").eq("qty", 105);
  await supabase.from("stock_movements").delete().eq("date", "2026-09-02").eq("ingredient_id", "ING-183").eq("qty", -105);
  await supabase.from("stock_movements").delete().eq("date", "2026-09-02").eq("ingredient_id", "ING-007").eq("qty", 10).eq("type", "Production");
  await supabase.from("stock_movements").delete().eq("date", "2026-09-02").eq("ingredient_id", "ING-155").eq("qty", 192).eq("type", "Production");

  // 2. Fetch and update the Sept 2 Recon
  const { data: existing } = await supabase.from('staff_submissions').select('id, data').eq('type', 'daily_recon');
  const sept2 = existing.find(e => e.data.date === "2026-09-02");
  
  if (sept2) {
    sept2.data.items.forEach(i => {
       if (i.name.includes("Bumbu Kuning")) i.sold_qty = 8;
       if (i.name.includes("Taliwang")) i.added_qty = 0;
       if (i.name.includes("Sop Ayam")) i.sold_qty = 2;
       if (i.name.includes("Telor")) { i.added_qty = 0; i.adj_qty = 0; i.sold_qty = 12; }
       if (i.name.includes("Sate Kambing")) i.sold_qty = 27; // +6 to cover the missing
       if (i.name.includes("Sate Ayam")) i.added_qty = 0;
       if (i.name.includes("Sop Iga")) i.sold_qty = 2;
       
       // Recompute Teori & Diff
       i.expected_qty = Math.max(0, i.opening_stock + (i.added_qty||0) + (i.adj_qty||0) - i.sold_qty - (i.waste_qty||0) - (i.production_qty||0));
       i.diff_qty = i.actual_qty - i.expected_qty;
       i.diff_value = i.diff_qty < 0 ? Math.abs(i.diff_qty) * (i.cost_per_unit || 0) : 0;
    });

    sept2.data.notes = `Analisis Sistem (True POS Math):
• Ayam Bumbu Kuning: 1 Gojek tidak diinput (Total Jual 8).
• Ayam Taliwang: +10 dihapus karena tidak ada produksi di tgl 2.
• Sop Ayam: 2 Gojek tidak diinput (Total Jual 2). Fisik 9 porsi adalah kontaminasi produksi tgl 3.
• Telor: PO 105 dan Adj -105 dihapus (Awal 150 sudah termasuk PO). Jual menjadi 12 (karena Nasgor Kambing pakai 1 telur).
• Sate Kambing: -6 tercover oleh 1 Tongseng & 1 Nasgor Kambing via Gojek (Jual = 27). Selisih klop.
• Sate Ayam: +192 dihapus karena itu produksi tgl 3.
• Sop Iga: 1 Gojek tidak diinput (Total Jual 2).`;

    const totalVar = sept2.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    sept2.data.total_variance_value = totalVar;
    
    await supabase.from('staff_submissions').update({ data: sept2.data }).eq('id', sept2.id);
    console.log("Sept 2nd report completely overhauled based on user facts!");
  }
}
run();
