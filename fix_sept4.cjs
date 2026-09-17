const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const { data: existing, error } = await supabase.from("staff_submissions").select("id, data").eq("type", "daily_recon");
  if (error) return console.error(error);
  
  const sept4 = existing.find(e => e.data.date === "2026-09-04");

  if (sept4) {
    sept4.data.items.forEach(i => {
       if (i.name.includes("Sop Ayam")) {
          i.sold_qty = 0; // "no sales"
          i.actual_qty = 10;
       }
       if (i.name.includes("Telor")) {
          i.sold_qty = 14; 
          i.actual_qty = 117;
       }
       if (i.name.includes("Sate Kambing")) {
          i.sold_qty = 5;
          i.actual_qty = 378;
       }

       // Recalculate
       i.expected_qty = Math.max(0, i.opening_stock + (i.added_qty||0) + (i.adj_qty||0) - (i.sold_qty||0) - (i.waste_qty||0) - (i.production_qty||0));
       i.diff_qty = i.actual_qty - i.expected_qty;
       i.diff_value = i.diff_qty < 0 ? Math.abs(i.diff_qty) * (i.cost_per_unit || 0) : 0;
    });

    sept4.data.notes = `Analisis Sistem (True POS Math):
• Sop Ayam: Tidak ada penjualan hari ini (Sisa Teori 9, Fisik 10, Surplus +1).
• Telor: Terjual 14. (Sisa Teori 119, Fisik 117, Selisih -2). Dugaan: dipakai untuk staff meal.
• Sate Kambing: Terjual 5. (Sisa Teori 378, Fisik 378). Sisa Fisik Klop!`;

    sept4.data.total_variance_value = sept4.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    await supabase.from("staff_submissions").update({ data: sept4.data }).eq("id", sept4.id);
    console.log("Sept 4th fixed!");
  }
}
run();
