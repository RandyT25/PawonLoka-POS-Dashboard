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

  const targetItems = ['Sop Iga Kambing (sub)', 'Ayam Bumbu Kuning (sub)', 'Sate Kambing (sub)', 'Sate Ayam (sub)', 'Ayam Taliwang (sub)', 'Telor']
  
  for (const t of targetItems) {
    const ing = ings.find(i => i.name === t)
    if (!ing) continue;
    
    let liveStock = ing.stock;
    
    let salesUsage = 0;
    orders.forEach(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      items.forEach(item => {
        const recs = recipes.filter(r => r.productSku === item.sku)
        recs.forEach(r => {
          if (r.ingredient_id === ing.id) {
            salesUsage += r.qty * item.qty;
          }
        })
      })
    })

    let additions = 0;
    let waste = 0;
    
    // To find opening stock, we take liveStock and reverse all movements that happened ON OR AFTER Sep 7th
    // Actually, in the POS, it's:
    // openingStock = liveStock
    // minus all additions on or after selected date
    // plus all sales on or after selected date
    // plus all waste on or after selected date
    
    // Since we only want the "Opening Stock" for Sep 7th, we should just reverse everything from Sep 7 to now.
    // Wait, the POS fetches ALL movements and ALL sales from Sep 7 to today, and reverses them.
    let rev_add = 0;
    let rev_waste = 0;
    movs.forEach(m => {
      if (m.ingredient_id === ing.id) {
        if (m.type === 'Waste' || m.type === 'Adjustment') {
           if (m.qty < 0) rev_waste += Math.abs(m.qty);
           else rev_add += m.qty;
        } else if (m.qty > 0) {
           rev_add += m.qty;
        } else if (m.type === 'Production' && m.qty < 0) {
           rev_waste += Math.abs(m.qty); // treated as consumption
        }
      }
    })
    
    // fetch orders >= Sep 7
    const { data: all_orders } = await supabase.from('orders').select('*').gte('date', '2026-09-07').eq('status', 'Paid')
    let rev_sales = 0;
    all_orders.forEach(o => {
      const items = typeof o.items === 'string' ? JSON.parse(o.items) : o.items;
      items.forEach(item => {
        const recs = recipes.filter(r => r.productSku === item.sku)
        recs.forEach(r => {
          if (r.ingredient_id === ing.id) {
            rev_sales += r.qty * item.qty;
          }
        })
      })
    })
    
    let expectedOpening = liveStock - rev_add + rev_waste + rev_sales;

    // For the specific date (Sep 7):
    movs.filter(m => m.date === '2026-09-07').forEach(m => {
      if (m.ingredient_id === ing.id) {
        if (m.type === 'Waste' || m.type === 'Adjustment') {
           if (m.qty < 0) waste += Math.abs(m.qty);
           else additions += m.qty;
        } else if (m.qty > 0) {
           additions += m.qty;
        }
      }
    })
    
    let expectedSisa = expectedOpening + additions - salesUsage - waste;
    
    console.log(`[${ing.name}] Opening: ${expectedOpening}, Masuk: ${additions}, Terjual: ${salesUsage}, Waste: ${waste} => Expected Sisa: ${expectedSisa}`)
  }
}
run()
