import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const envContent = fs.readFileSync('.env', 'utf8')
const supabaseUrl = envContent.match(/VITE_SUPABASE_URL=(.*)/)[1]
const supabaseKey = envContent.match(/VITE_SUPABASE_ANON_KEY=(.*)/)[1]
const supabase = createClient(supabaseUrl, supabaseKey)

async function run() {
  const { data, error } = await supabase
    .from('staff_submissions')
    .select('*')
    .eq('type', 'daily_recon')
    .order('submitted_at', { ascending: false })
    .limit(5)
  
  if (error) {
    console.error(error)
    return
  }
  
  data.forEach(d => {
    console.log(`Report ID: ${d.id}, Date: ${d.submitted_at}`)
    const items = d.data.items || []
    const hasSopIga = items.find(i => i.id === 'ING-170' || i.name.toLowerCase().includes('sop iga'))
    if (hasSopIga) {
      console.log(' -> CONTAINS SOP IGA:', hasSopIga.name)
    } else {
      console.log(' -> No Sop Iga')
    }
  })
}

run()
