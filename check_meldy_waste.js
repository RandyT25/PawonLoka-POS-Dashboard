import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data: sub } = await supabase.from('staff_submissions').select('*').eq('type', 'waste').order('submitted_at', { ascending: false }).limit(5)
  console.log("Submissions:", sub.map(s => ({ id: s.id, submitted_at: s.submitted_at, by: s.submitted_by })))

  const { data: moves } = await supabase.from('stock_movements').select('*').eq('type', 'Waste').order('created_at', { ascending: false }).limit(5)
  console.log("Movements:", moves.map(m => ({ id: m.id, date: m.date, created_at: m.created_at, note: m.note })))
}
run()
