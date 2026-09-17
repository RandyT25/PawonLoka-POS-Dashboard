import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('stock_movements')
    .select('id, type, qty, ingredient_id, ingredient_name, date, time, note')
    .eq('type', 'Production')
    .gte('date', '2026-09-14')
  
  if (error) {
    console.error(error)
    return
  }
  
  // Group by date+time (which represents a single production event)
  const events = {}
  data.forEach(d => {
    const key = `${d.date}_${d.time}`
    if (!events[key]) events[key] = []
    events[key].push(d)
  })

  let missing = 0
  for (const [key, moves] of Object.entries(events)) {
    const hasYield = moves.some(m => m.qty > 0)
    const hasConsumed = moves.some(m => m.qty < 0)
    if (hasConsumed && !hasYield) {
      console.log(`Missing yield for event ${key}:`)
      moves.forEach(m => console.log(`  ${m.qty} ${m.ingredient_name}`))
      missing++
    }
  }
  if (missing === 0) console.log("All production events have a yield!")
}

run()
