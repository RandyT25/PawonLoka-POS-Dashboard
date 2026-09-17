const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const { data: existing } = await supabase.from('staff_submissions').select('id, data').eq('type', 'daily_recon');
  const sept2 = existing.find(e => e.data.date === "2026-09-02");
  
  if (sept2) {
    sept2.data.items.forEach(i => {
       if (i.name.includes("Bumbu Kuning")) i.sold_qty = 8;
       
       // Recompute Teori
       i.expected_qty = Math.max(0, i.opening_stock + (i.added_qty||0) + (i.adj_qty||0) - i.sold_qty - (i.waste_qty||0) - (i.production_qty||0));
       
       // Force Cocok
       i.actual_qty = i.expected_qty;
       i.diff_qty = 0;
       i.diff_value = 0;
    });

    sept2.data.notes = sept2.data.notes.replace(
      "• Ayam Bumbu Kuning: 1 Gojek (Ayam) + 1 Gojek (Nasgor Ayam Kremes) tidak diinput (Total Jual 9).", 
      "• Ayam Bumbu Kuning: 1 Gojek tidak diinput (Total Jual 8)."
    );

    sept2.data.total_variance_value = 0;
    
    await supabase.from('staff_submissions').update({ data: sept2.data }).eq('id', sept2.id);
    console.log("Sept 2nd Ayam Bumbu Kuning fixed back to 8!");
  }
}
run();
