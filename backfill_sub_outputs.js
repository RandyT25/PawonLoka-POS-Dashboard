import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions')
    .select('*')
    .eq('type', 'production')
    .gte('submitted_at', '2026-09-13T00:00:00Z')
    
  const { data: ings } = await supabase.from('ingredients').select('*')
  const { data: srs } = await supabase.from('sub_recipes').select('*')
  
  for (const s of subs) {
    // Check if it already has an output movement
    const { data: movs } = await supabase.from('stock_movements')
      .select('*')
      .eq('ref', s.id)
      .gt('qty', 0) // Outputs are positive qty
    
    if (movs && movs.length > 0) continue; // Already has output
    
    // Find output ingredient
    let outputIngredientId = s.data.item_id || srs.find(sr => sr.id === s.data.sub_recipe_id)?.ingredient_id
    if (!outputIngredientId) continue;
    
    const item = ings.find(i => i.id === outputIngredientId)
    if (!item) continue;
    
    // It's missing! Backfill it.
    console.log(`Backfilling for ${item.name} (${s.id}) qty ${s.data.actual_yield ?? s.data.batch_qty}`)
    
    const producedQty = s.data.actual_yield ?? s.data.batch_qty
    // In our buggy code, toBaseUnit returned producedQty directly for Ayam Bumbu Kuning.
    const producedQtyBase = producedQty
    
    const { data:freshItem } = await supabase.from("ingredients").select("stock").eq("id",item.id).maybeSingle();
    const newItemStock = (freshItem?.stock ?? item.stock ?? 0) + producedQtyBase;
    
    await supabase.from("ingredients").update({ stock:newItemStock }).eq("id",item.id);
    
    const movId = "MOV-" + Date.now() + "-" + Math.random().toString(36).slice(2,6);
    await supabase.from("stock_movements").insert({
      id: movId, 
      type:"Production", 
      ingredient_id:item.id, 
      ingredient_name:item.name,
      qty:producedQtyBase, 
      unit:item.unit, 
      ref: s.id,
      note:"Orphan backfill: Auto-approved production output by " + s.submitted_by + " (Script Fix)",
      date:s.data.date, 
      time:new Date(s.submitted_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"})
    });
  }
  console.log("Done backfilling!")
}
run()
