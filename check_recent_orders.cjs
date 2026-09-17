const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(JSON.stringify(orders.map(o => ({ id: o.id, total: o.total, status: o.status, created_at: o.created_at, payment_method: o.payment_method, items: o.items })), null, 2));
}

run();
