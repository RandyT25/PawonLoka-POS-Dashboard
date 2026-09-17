import { createClient } from '@supabase/supabase-js'

const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU")
async function test() {
  const q = supabase.from("products").select("sku").limit(1)
  console.log("Has catch?", typeof q.catch === 'function')
  
  const p = q.then(() => {})
  console.log("Then has catch?", typeof p.catch === 'function')
}
test()
