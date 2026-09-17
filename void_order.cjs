const { createClient } = require("@supabase/supabase-js");
const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU");

async function run() {
  const orderId = "ORD-1788593269404";

  // 1. Void the order
  await supabase.from("orders").update({ status: "Void" }).eq("id", orderId);
  console.log("Order voided.");

  // 2. Mark stock movements as Void
  await supabase.from("stock_movements").update({ type: "Void" }).eq("order_id", orderId);
  console.log("Stock movements voided.");

  // 3. Update Sept 5th Daily Recon
  const { data: existing } = await supabase.from("staff_submissions").select("id, data").eq("type", "daily_recon");
  const sept5 = existing.find(e => e.data.date === "2026-09-05");
  const sept6 = existing.find(e => e.data.date === "2026-09-06");

  if (sept5) {
    sept5.data.items.forEach(i => {
       if (i.name.includes("Sop Iga Kambing")) i.sold_qty = Math.max(0, i.sold_qty - 1);
       if (i.name.includes("Telor")) i.sold_qty = Math.max(0, i.sold_qty - 1);
       if (i.name.includes("Ayam Bumbu Kuning")) i.sold_qty = Math.max(0, i.sold_qty - 1);
       if (i.name.includes("Sate Kambing")) i.sold_qty = Math.max(0, i.sold_qty - 3);

       i.expected_qty = Math.max(0, i.opening_stock + (i.added_qty||0) + (i.adj_qty||0) - (i.sold_qty||0) - (i.waste_qty||0) - (i.production_qty||0));
       i.diff_qty = i.actual_qty - i.expected_qty;
       i.diff_value = i.diff_qty < 0 ? Math.abs(i.diff_qty) * (i.cost_per_unit || 0) : 0;
    });
    
    sept5.data.notes = (sept5.data.notes || "") + "\n\n(Auto-Fix: Order #269404 di-void. Terjual dikurangi: Sop Iga -1, Telor -1, Ayam Kuning -1, Sate Kambing -3).";
    sept5.data.total_variance_value = sept5.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    await supabase.from("staff_submissions").update({ data: sept5.data }).eq("id", sept5.id);
    console.log("Sept 5th recon updated.");
  }

  // 4. Roll forward to Sept 6th
  if (sept5 && sept6) {
    sept6.data.items.forEach(i6 => {
       const i5 = sept5.data.items.find(x => x.ingredient_id === i6.ingredient_id);
       if (i5) i6.opening_stock = i5.actual_qty;

       i6.expected_qty = Math.max(0, i6.opening_stock + (i6.added_qty||0) + (i6.adj_qty||0) - (i6.sold_qty||0) - (i6.waste_qty||0) - (i6.production_qty||0));
       i6.diff_qty = i6.actual_qty - i6.expected_qty;
       i6.diff_value = i6.diff_qty < 0 ? Math.abs(i6.diff_qty) * (i6.cost_per_unit || 0) : 0;
    });
    sept6.data.total_variance_value = sept6.data.items.reduce((sum, i) => sum + (i.diff_value || 0), 0);
    await supabase.from("staff_submissions").update({ data: sept6.data }).eq("id", sept6.id);
    console.log("Sept 6th recon rolled forward.");
  }

  console.log("Done!");
}
run();
