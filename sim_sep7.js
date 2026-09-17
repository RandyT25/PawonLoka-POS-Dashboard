import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: ings } = await supabase.from('ingredients').select('id, name, stock')
  const { data: movs } = await supabase.from('stock_movements').select('*').gte('date', '2026-09-07')
  const { data: orders } = await supabase.from('orders').select('*').eq('date', '2026-09-07').eq('status', 'Paid')
  const { data: recipes } = await supabase.from('recipes').select('*')

  const targetItems = ['Sop Iga Kambing (sub)', 'Ayam Bumbu Kuning (sub)', 'Sate Kambing (sub)', 'Sate Ayam (sub)', 'Ayam Taliwang (sub)', 'Telor', 'Sop Ayam (sub)']
  
  for (const t of targetItems) {
    const ing = ings.find(i => i.name === t)
    if (!ing) continue;
    
    let liveStock = ing.stock;
    
    // Reverse movs > Sep 7 to get closing stock of Sep 7. Wait, today is Sep 7th?
    // Let's assume today is Sep 7th, so liveStock IS the closing stock (sisa fisik).
    // Wait, the POS expected stock for today is just: opening_stock + Masuk - Terjual - Waste/Adj
    // opening_stock = liveStock - (additions) + (sales) - (adjustments) -- actually DailyStockModal does this:
    let opening_stock = liveStock;
    let additions = 0;
    let waste = 0;
    let sold = 0;
    
    // add sales to opening stock (to go backwards in time)
    orders.forEach(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      items.forEach(item => {
        const recs = recipes.filter(r => r.productSku === item.sku)
        recs.forEach(r => {
          if (r.ingredient_id === ing.id) {
            sold += r.qty * item.qty;
            opening_stock += r.qty * item.qty;
          }
        })
      })
    })
    
    movs.forEach(m => {
      if (m.ingredient_id === ing.id) {
        if (m.date > '2026-09-07') {
          // reverse strictly future movements
          opening_stock -= m.qty; 
        } else if (m.date === '2026-09-07') {
          // today's movements
          if (m.type === 'Waste' || m.type === 'Adjustment') {
             if (m.qty < 0) {
               waste += Math.abs(m.qty)
               opening_stock += Math.abs(m.qty) // reverse outward movement
             } else {
               additions += m.qty
               opening_stock -= m.qty // reverse inward movement
             }
          } else if (m.qty > 0) {
             additions += m.qty
             opening_stock -= m.qty // reverse inward movement
          } else if (m.qty < 0) {
             // what about production ingredients used?
             opening_stock += Math.abs(m.qty)
          }
        }
      }
    })
    
    let expected = opening_stock + additions - sold - waste;
    console.log(`[${ing.name}] Opening: ${opening_stock}, Masuk: ${additions}, Terjual: ${sold}, Waste: ${waste} => Expected: ${expected}`)
  }
}
run()
