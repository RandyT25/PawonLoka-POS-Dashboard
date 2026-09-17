const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const { data: existing, error } = await supabase.from("staff_submissions").select("id, data").eq("type", "daily_recon");
  if (error) return console.error(error);
  
  const sept4 = existing.find(e => e.data.date === "2026-09-04");

  if (sept4) {
    sept4.data.items.forEach(i => {
       if (i.name.includes("Telor")) {
          i.adj_qty = -2; // Officially log the staff meal as an approved adjustment
       }

       // Recalculate
       i.expected_qty = Math.max(0, i.opening_stock + (i.added_qty||0) + (i.adj_qty||0) - (i.sold_qty||0) - (i.waste_qty||0) - (i.production_qty||0));
       i.diff_qty = i.actual_qty - i.expected_qty;
       i.diff_value = i.diff_qty < 0 ? Math.abs(i.diff_qty) * (i.cost_per_unit || 0) : 0;
    });

    // Update the note
    sept4.data.notes = sept4.data.notes.replace(
      "• Telor (-2 Selisih): Terjual 14 butir. Sisa Teori 119 tapi Fisik 117. Kemungkinan terpakai untuk staff meal.",
      "• Telor: Terjual 14 butir. Penggunaan 2 butir untuk Staff Meal telah di-approve (masuk kolom Adj). Fisik ✓ Cocok 117."
    );

    sept4.data.total_variance_value = sept4.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    await supabase.from("staff_submissions").update({ data: sept4.data }).eq("id", sept4.id);
    console.log("Sept 4th Staff Meal approved and logged!");
  }
}
run();
