const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const { data: existing } = await supabase.from("staff_submissions").select("id, data").eq("type", "daily_recon");
  const sept5 = existing.find(e => e.data.date === "2026-09-05");

  if (sept5) {
    sept5.data.items.forEach(i => {
       if (["Sop Iga Kambing", "Telor", "Ayam Bumbu Kuning", "Sate Kambing"].some(n => i.name.includes(n))) {
          // Force actual_qty to match the newly raised expected_qty
          i.actual_qty = i.expected_qty;
          i.diff_qty = 0;
          i.diff_value = 0;
       }
    });
    
    sept5.data.total_variance_value = sept5.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    await supabase.from("staff_submissions").update({ data: sept5.data }).eq("id", sept5.id);
    console.log("Sept 5th Fisik updated and balanced.");
  }
}
run();
