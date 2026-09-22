import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  // Get ALL production and waste movements from Sept 17-23
  const { data: prods } = await supabase.from('stock_movements').select('*')
    .in('type', ['Production', 'Waste'])
    .gte('date', '2026-09-17')
    .lte('date', '2026-09-23')
    .order('created_at', { ascending: true })

  // Also get waste submissions
  const { data: wasteSubs } = await supabase.from('staff_submissions').select('*')
    .eq('type', 'waste')
    .gte('submitted_at', '2026-09-17T00:00:00Z')
    .order('submitted_at', { ascending: true })

  // Also get production submissions
  const { data: prodSubs } = await supabase.from('staff_submissions').select('*')
    .eq('type', 'production')
    .gte('submitted_at', '2026-09-17T00:00:00Z')
    .order('submitted_at', { ascending: true })

  console.log("=== PRODUCTION MOVEMENTS ===")
  prods.filter(m => m.type === 'Production').forEach(m => {
    const created = new Date(m.created_at)
    const localHour = created.getUTCHours() + 8 // UTC+8 (WITA/WIB+1)
    console.log(`  date=${m.date} | created_at=${m.created_at} | localHour~${localHour % 24} | ${m.ingredient_name} qty=${m.qty} | ref=${m.ref}`)
  })

  console.log("\n=== WASTE MOVEMENTS ===")
  prods.filter(m => m.type === 'Waste').forEach(m => {
    const created = new Date(m.created_at)
    const localHour = created.getUTCHours() + 8
    console.log(`  date=${m.date} | created_at=${m.created_at} | localHour~${localHour % 24} | ${m.ingredient_name} qty=${m.qty} | note=${m.note}`)
  })

  console.log("\n=== WASTE SUBMISSIONS (staff_submissions) ===")
  ;(wasteSubs || []).forEach(s => {
    const submitted = new Date(s.submitted_at)
    const localHour = submitted.getUTCHours() + 8
    console.log(`  submitted_at=${s.submitted_at} | localHour~${localHour % 24} | by=${s.submitted_by} | id=${s.id}`)
  })

  console.log("\n=== PRODUCTION SUBMISSIONS (staff_submissions) ===")
  ;(prodSubs || []).forEach(s => {
    const submitted = new Date(s.submitted_at)
    const localHour = submitted.getUTCHours() + 8
    console.log(`  submitted_at=${s.submitted_at} | localHour~${localHour % 24} | by=${s.submitted_by} | id=${s.id}`)
  })

  // Now check recon submissions to see when cashier submitted
  const { data: reconSubs } = await supabase.from('staff_submissions').select('id, submitted_at, data')
    .eq('type', 'daily_recon')
    .gte('submitted_at', '2026-09-17T00:00:00Z')
    .order('submitted_at', { ascending: true })

  console.log("\n=== RECON SUBMISSIONS ===")
  ;(reconSubs || []).forEach(s => {
    const submitted = new Date(s.submitted_at)
    const localHour = submitted.getUTCHours() + 8
    console.log(`  date=${s.data?.date} | submitted_at=${s.submitted_at} | localHour~${localHour % 24} | id=${s.id}`)
  })
}
run()
