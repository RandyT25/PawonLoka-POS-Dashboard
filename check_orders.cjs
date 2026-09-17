const { createClient } = require('@supabase/supabase-js');
const supabaseUrl = 'https://fnfivhnisigfnbvojonz.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZuZml2aG5pc2lnZm5idm9qb256Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMjE2MzEsImV4cCI6MjA5NDU5NzYzMX0.8VE_PW4JO6H9Z5sIPCFy0jzLo6Zqo8_qzPRi9w9xBfU';
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const targetSuffixes = ['773025', '742382', '088436', '056746'];
  
  const startTime = "2026-09-06T06:00:00+08:00";
  const endTime = "2026-09-07T05:59:59+08:00";
  
  console.log(`Querying Sept 6th Shift (from ${startTime} to ${endTime})...\n`);
  
  const { data: shiftData, error: shiftError } = await supabase
    .from('orders')
    .select('id, total, created_at')
    .gte('created_at', startTime)
    .lte('created_at', endTime)
    .order('created_at', { ascending: false });

  if (shiftError) {
    console.error(shiftError);
    return;
  }
  
  console.log(`Found ${shiftData.length} orders in this shift timeframe.\n`);
  
  const foundSuffixes = [];
  
  shiftData.forEach(o => {
    const idStr = String(o.id);
    const suffix = idStr.slice(-6);
    if (targetSuffixes.includes(suffix)) {
      foundSuffixes.push(suffix);
      const d = new Date(o.created_at);
      console.log(`MATCHED: #${suffix} | Total: ${o.total} | Local Time: ${d.toLocaleString('id-ID', {timeZone: 'Asia/Makassar'})}`);
    }
  });

  console.log(`\nDid we find all of them in the same shift?`);
  targetSuffixes.forEach(s => {
    console.log(`- #${s}: ${foundSuffixes.includes(s) ? 'YES' : 'NO'}`);
  });
}

run();
