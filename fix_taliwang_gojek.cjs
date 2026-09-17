const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const { data: existing } = await supabase.from('staff_submissions').select('id, data').eq('type', 'daily_recon');
  const sept1 = existing.find(e => e.data.date === "2026-09-01");
  
  if (sept1) {
    const taliwang = sept1.data.items.find(i => i.name.includes("Taliwang"));
    if (taliwang) {
      taliwang.sold_qty = 2; // Was 1, now 2 because of unrecorded Gojek sale
      
      // Recalculate
      taliwang.expected_qty = Math.max(0, taliwang.opening_stock + (taliwang.added_qty||0) + (taliwang.adj_qty||0) - taliwang.sold_qty - (taliwang.waste_qty||0) - (taliwang.production_qty||0));
      taliwang.diff_qty = taliwang.actual_qty - taliwang.expected_qty;
      taliwang.diff_value = taliwang.diff_qty < 0 ? Math.abs(taliwang.diff_qty) * (taliwang.cost_per_unit || 0) : 0;
      
      sept1.data.notes = sept1.data.notes + "\n\n• UPDATE: Ayam Taliwang ditambah 1 Terjual (Total 2) karena ada order Gojek yang lupa diinput ke POS. Selisih menjadi klop.";
      
      const totalVar = sept1.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
      sept1.data.total_variance_value = totalVar;
      
      await supabase.from('staff_submissions').update({ data: sept1.data }).eq('id', sept1.id);
      console.log("Sept 1st Taliwang Gojek sale applied!");
    }
  }
}
run();
