import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: p } = await supabase.from('staff_submissions').select('*').eq('type', 'production').ilike('data->>date', '%2026-09-06%').eq('status', 'approved')
  
  const toInsert = []
  
  for (const sub of p) {
    const d = sub.data
    // Check if a stock movement already exists for this submission ID with qty > 0
    const { data: movs } = await supabase.from('stock_movements').select('*').eq('ref', sub.id).gt('qty', 0)
    if (movs.length === 0) {
      // Missing! Find the ingredient ID for this item_name
      // Note: item_name could be "Ayam Bumbu Kuning (sub)"
      let itemName = d.item_name
      if (itemName === 'Nasi') continue; // I saw Nasi had one, wait, did Nasi have one? Let me double check, I did see Nasi earlier.
      // Wait, let's find the ingredient in the database
      const { data: ings } = await supabase.from('ingredients').select('id, name, unit').ilike('name', itemName)
      if (ings && ings.length > 0) {
        const item = ings[0]
        console.log(`Missing movement for ${item.name}, qty: ${d.actual_yield}`)
        toInsert.push({
          id: "MOV-"+Date.now()+"-"+Math.random().toString(36).slice(2,6),
          type: "Production",
          ingredient_id: item.id,
          ingredient_name: item.name,
          qty: d.actual_yield,
          unit: item.unit,
          ref: sub.id,
          note: "Orphan backfill: Auto-approved production output by "+sub.submitted_by,
          date: d.date,
          time: new Date(sub.reviewed_at || sub.created_at).toLocaleTimeString("id-ID",{hour:"2-digit",minute:"2-digit"}),
        })
      }
    }
  }
  
  console.log("To insert:", toInsert)
  if (toInsert.length > 0) {
    await supabase.from('stock_movements').insert(toInsert)
  }
}
run()
