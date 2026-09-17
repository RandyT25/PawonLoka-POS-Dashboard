const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const { data: existing } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').order('created_at', {ascending: true});
  
  const sept2 = existing.find(e => e.data.date === "2026-09-02");
  const sept3 = existing.find(e => e.data.date === "2026-09-03");
  const sept4 = existing.find(e => e.data.date === "2026-09-04");
  
  // Update Sept 3 based on Sept 2
  if (sept2 && sept3) {
    sept3.data.items.forEach(i3 => {
      const i2 = sept2.data.items.find(x => x.ingredient_id === i3.ingredient_id);
      if (i2) {
        i3.opening_stock = i2.actual_qty; // Force match previous day's ending
        i3.expected_qty = Math.max(0, i3.opening_stock + (i3.added_qty||0) + (i3.adj_qty||0) - (i3.sold_qty||0) - (i3.waste_qty||0) - (i3.production_qty||0));
        i3.diff_qty = i3.actual_qty - i3.expected_qty;
        i3.diff_value = i3.diff_qty < 0 ? Math.abs(i3.diff_qty) * (i3.cost_per_unit || 0) : 0;
      }
    });
    sept3.data.total_variance_value = sept3.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    await supabase.from('staff_submissions').update({ data: sept3.data }).eq('id', sept3.id);
    console.log("Rolled stock from Sept 2 -> Sept 3");
  }

  // Update Sept 4 based on Sept 3
  if (sept3 && sept4) {
    sept4.data.items.forEach(i4 => {
      const i3 = sept3.data.items.find(x => x.ingredient_id === i4.ingredient_id);
      if (i3) {
        i4.opening_stock = i3.actual_qty; // Force match previous day's ending
        i4.expected_qty = Math.max(0, i4.opening_stock + (i4.added_qty||0) + (i4.adj_qty||0) - (i4.sold_qty||0) - (i4.waste_qty||0) - (i4.production_qty||0));
        i4.diff_qty = i4.actual_qty - i4.expected_qty;
        i4.diff_value = i4.diff_qty < 0 ? Math.abs(i4.diff_qty) * (i4.cost_per_unit || 0) : 0;
      }
    });
    sept4.data.total_variance_value = sept4.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    await supabase.from('staff_submissions').update({ data: sept4.data }).eq('id', sept4.id);
    console.log("Rolled stock from Sept 3 -> Sept 4");
  }
}
run();
