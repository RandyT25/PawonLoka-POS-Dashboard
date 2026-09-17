import { createClient } from '@supabase/supabase-js'
import fs from 'fs'

const env = fs.readFileSync('.env', 'utf8')
let url = env.match(/VITE_SUPABASE_URL=(.*)/)?.[1]
let key = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/)?.[1]
const supabase = createClient(url, key)

async function run() {
  const { data: subs } = await supabase.from('staff_submissions')
    .select('*')
    .in('id', ['SS-1789316067822', 'SS-1789316039834', 'SS-1789315998845', 'SS-1789315976179'])
    
  console.log("Recent Production Submissions:")
  console.log(JSON.stringify(subs, null, 2))
}
run()
