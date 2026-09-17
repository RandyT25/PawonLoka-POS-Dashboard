import { createClient } from '@supabase/supabase-js'

const supabase = createClient("https://fnfivhnisigfnbvojonz.supabase.co", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU")
async function test() {
  const { data, error } = await supabase.from("products").insert({
    sku: "PRD" + Date.now(),
    name: "Test Product No Cat",
    cat: "",
    price: 10000
  })
  console.log("Error empty cat:", error)

  const { data: d2, error: e2 } = await supabase.from("products").insert({
    sku: "PRD" + Date.now() + "2",
    name: "Test Product NULL Cat",
    price: 10000
  })
  console.log("Error NULL cat:", e2)
}
test()
