const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: orders, error } = await supabase
    .from('orders')
    .select('*')
    .eq('id', 697921);

  console.log(JSON.stringify(orders, null, 2));
}

run();
