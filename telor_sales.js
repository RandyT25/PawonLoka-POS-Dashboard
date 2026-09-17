import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const targetDate = '2026-09-08'
  const { data: recipes } = await supabase.from('recipes').select('productSku, ingredient_id, qty, unit, ingredient_name')
  const { data: orders } = await supabase.from('orders').select('id, items, status').eq('date', targetDate).eq('status', 'Paid')
  
  const telorSales = []
  
  orders.forEach(order => {
    let items = typeof order.items === 'string' ? JSON.parse(order.items) : order.items
    items.forEach(it => {
      const matchRec = recipes.filter(r => r.productSku === it.sku && r.ingredient_id === 'ING-183') // Telor
      matchRec.forEach(r => {
        telorSales.push({
          menu: it.name,
          qty_ordered: it.qty,
          telor_per_portion: r.qty,
          total_telor: r.qty * it.qty
        })
      })
    })
  })
  
  const breakdown = {}
  telorSales.forEach(s => {
    if (!breakdown[s.menu]) breakdown[s.menu] = 0
    breakdown[s.menu] += s.total_telor
  })
  console.log("Total Telor Sold Breakdown:")
  console.log(breakdown)
}
run()
