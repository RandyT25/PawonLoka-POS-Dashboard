const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('total', 101000)
    .order('created_at', { ascending: false })
    .limit(5);

  if (error) {
    console.error("Error:", error);
    return;
  }
  
  console.log(JSON.stringify(orders.map(o => ({ id: o.id, items: o.items, payments: o.payments, total: o.total, status: o.status, pay: o.pay })), null, 2));
}

run();
