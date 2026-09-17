import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const targetDate = '2026-09-09'
  
  const { data: allIngredients } = await supabase.from('ingredients').select('id, name, unit, stock, cost_per_unit')
  const { data: recipes } = await supabase.from('recipes').select('productSku, ingredient_id, qty, unit, ingredient_name')
  const { data: orders } = await supabase.from('orders').select('id, items, status').eq('date', targetDate).eq('status', 'Paid')
  const { data: movements } = await supabase.from('stock_movements').select('ingredient_id, type, qty, date, notes').eq('date', targetDate)
  const { data: prevRecon } = await supabase.from('staff_submissions').select('*').eq('type', 'daily_recon').eq('data->>date', '2026-09-08').single()
  
  const trackedNames = [
    'Sop Ayam (sub)', 'Sop Iga Kambing (sub)', 'Ayam Bumbu Kuning (sub)', 
    'Sate Kambing (sub)', 'Sate Ayam (sub)', 'Ayam Taliwang (sub)', 'Telor'
  ]
  
  const soldQty = {}
  const breakdown = {}
  orders.forEach(order => {
    let items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
    items.forEach(it => {
      const matchRec = recipes.filter(r => r.productSku === it.sku)
      matchRec.forEach(r => {
        soldQty[r.ingredient_id] = (soldQty[r.ingredient_id] || 0) + (r.qty * it.qty)
        
        if (!breakdown[r.ingredient_name]) breakdown[r.ingredient_name] = {}
        breakdown[r.ingredient_name][it.name] = (breakdown[r.ingredient_name][it.name] || 0) + it.qty
      })
    })
  })
  
  const additions = {}
  const waste = {}
  const prodDed = {}
  const adj = {}
  
  ;(movements || []).forEach(m => {
    const qty = parseFloat(m.qty)
    const ingId = m.ingredient_id
    if (m.type === 'Purchase') additions[ingId] = (additions[ingId] || 0) + qty
    else if (m.type === 'Production') {
      if (qty > 0) additions[ingId] = (additions[ingId] || 0) + qty
      else prodDed[ingId] = (prodDed[ingId] || 0) + Math.abs(qty)
    }
    else if (m.type === 'Adjustment') {
      if (qty > 0) additions[ingId] = (additions[ingId] || 0) + qty
      else adj[ingId] = (adj[ingId] || 0) + Math.abs(qty)
    }
    else if (m.type === 'Waste') {
      waste[ingId] = (waste[ingId] || 0) + Math.abs(qty)
    }
  })
  
  const prevCountsMap = {}
  if (prevRecon && prevRecon.data.items) {
    prevRecon.data.items.forEach(it => prevCountsMap[it.ingredient_id] = it.actual_qty)
  }
  
  trackedNames.forEach(name => {
    const ing = allIngredients.find(i => i.name === name)
    if (!ing) return
    const id = ing.id
    
    const openingStock = prevCountsMap[id] || 0
    const added = additions[id] || 0
    const sold = soldQty[id] || 0
    const wasted = waste[id] || 0
    const pd = prodDed[id] || 0
    const adjust = adj[id] || 0
    
    const expected = Math.max(0, openingStock + added + adjust - sold - wasted - pd)
    
    console.log(`[${name}] Opening: ${openingStock}, Masuk: ${added}, Terjual: ${sold}, Waste: ${wasted}, ProdDed: ${pd}, Adj: ${adjust} => Expected: ${expected}`)
    
    if (wasted > 0 || adjust > 0 || pd > 0 || added > 0) {
      ;(movements||[]).filter(m => m.ingredient_id === id).forEach(m => {
        console.log(`  -> Movement: ${m.type} ${m.qty} (${m.notes})`)
      })
    }
  })
  
  console.log("\nSales Breakdown:")
  console.log(breakdown)
}
run()
