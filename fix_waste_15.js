import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Move waste from 14th to 15th
  const { data: moves } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-14').eq('type', 'Waste')
  
  // Find Meldy's waste (Ayam Bumbu Kuning) and Mahes's waste (Lemineral)
  // that were created on Sept 15 UTC (which is Sept 14 UTC)
  for (const m of moves) {
    if (m.created_at.includes('2026-09-14T20') || m.created_at.includes('2026-09-14T11')) { // 20:34 UTC is 4:34 AM
        console.log(`Moving waste ${m.id} to Sept 15...`)
        await supabase.from('stock_movements').update({ date: '2026-09-15' }).eq('id', m.id)
    }
  }

  // Same for any other movements on early morning of Sept 15th that got logged as Sept 14th
  const { data: allMoves } = await supabase.from('stock_movements').select('*').eq('date', '2026-09-14')
  for (const m of allMoves) {
    if (m.created_at >= '2026-09-14T16:00:00Z' && m.created_at <= '2026-09-14T23:59:59Z') {
        console.log(`Moving movement ${m.id} to Sept 15...`)
        await supabase.from('stock_movements').update({ date: '2026-09-15' }).eq('id', m.id)
    }
  }
}
run()
