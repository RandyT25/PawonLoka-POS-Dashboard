const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fnfivhnisigfnbvojonz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase
    .from('order_anomalies')
    .select('diff');

  if (error) {
    console.error(error);
  } else {
    const counts = {};
    data.forEach(d => {
      counts[d.diff] = (counts[d.diff] || 0) + 1;
    });
    console.log(counts);
  }
}
run();
