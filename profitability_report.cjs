const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  let allOrders = [];
  let page = 0;
  const size = 1000;
  let hasMore = true;
  
  while (hasMore) {
    const { data: orders, error } = await supabase
      .from('orders')
      .select('items, status, created_at')
      .range(page * size, (page + 1) * size - 1);

    if (error) {
      console.error('Error fetching orders:', error);
      return;
    }
    
    if (orders.length > 0) {
      allOrders = allOrders.concat(orders);
      page++;
    } else {
      hasMore = false;
    }
  }

  const paidOrders = allOrders.filter(o => o.status === 'Paid' || o.status === 'paid');

  let earliestDate = new Date();
  const ayamStats = { qty: 0, revenue: 0, cogs: 0 };
  
  const kambingCategories = {
    'Sop Iga Kambing': { qty: 0, revenue: 0, cogs: 0 },
    'Rica Kambing': { qty: 0, revenue: 0, cogs: 0 },
    'Tongseng': { qty: 0, revenue: 0, cogs: 0 },
    'Other Kambing': { qty: 0, revenue: 0, cogs: 0 }
  };
  let totalKambing = { qty: 0, revenue: 0, cogs: 0 };

  paidOrders.forEach(o => {
    const d = new Date(o.created_at);
    if (d < earliestDate) earliestDate = d;

    const raw = o.items || [];
    const items = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);

    items.forEach(i => {
      const name = i.name || '';
      const nameLower = name.toLowerCase();
      const qty = Number(i.qty || 1);
      const price = Number(i.price || 0) * qty;
      const cogs = Number(i.cogs || 0) * qty;

      if (nameLower.includes('ayam')) {
        ayamStats.qty += qty;
        ayamStats.revenue += price;
        ayamStats.cogs += cogs;
      }
      
      const isKambing = nameLower.includes('kambing') || nameLower.includes('tongseng') || nameLower.includes('iga');
      
      if (isKambing) {
        if (nameLower.includes('sapi')) return;

        totalKambing.qty += qty;
        totalKambing.revenue += price;
        totalKambing.cogs += cogs;

        if (nameLower.includes('sop iga') || nameLower.includes('iga')) {
          kambingCategories['Sop Iga Kambing'].qty += qty;
          kambingCategories['Sop Iga Kambing'].revenue += price;
          kambingCategories['Sop Iga Kambing'].cogs += cogs;
        } else if (nameLower.includes('rica')) {
          kambingCategories['Rica Kambing'].qty += qty;
          kambingCategories['Rica Kambing'].revenue += price;
          kambingCategories['Rica Kambing'].cogs += cogs;
        } else if (nameLower.includes('tongseng')) {
          kambingCategories['Tongseng'].qty += qty;
          kambingCategories['Tongseng'].revenue += price;
          kambingCategories['Tongseng'].cogs += cogs;
        } else {
          kambingCategories['Other Kambing'].qty += qty;
          kambingCategories['Other Kambing'].revenue += price;
          kambingCategories['Other Kambing'].cogs += cogs;
        }
      }
    });
  });

  console.log('--- PROFITABILITY REPORT ---');
  console.log(`Earliest Order Date: ${earliestDate.toISOString().slice(0, 10)}`);
  console.log('\nAYAM STATS:');
  console.log(`Total Qty: ${ayamStats.qty}`);
  console.log(`Total Revenue: Rp ${ayamStats.revenue.toLocaleString()}`);
  console.log(`Total COGS: Rp ${ayamStats.cogs.toLocaleString()}`);
  console.log(`Gross Profit: Rp ${(ayamStats.revenue - ayamStats.cogs).toLocaleString()}`);
  console.log(`Margin: ${ayamStats.revenue ? ((ayamStats.revenue - ayamStats.cogs) / ayamStats.revenue * 100).toFixed(2) : 0}%`);

  console.log('\nTOTAL KAMBING STATS:');
  console.log(`Total Qty: ${totalKambing.qty}`);
  console.log(`Total Revenue: Rp ${totalKambing.revenue.toLocaleString()}`);
  console.log(`Total COGS: Rp ${totalKambing.cogs.toLocaleString()}`);
  console.log(`Gross Profit: Rp ${(totalKambing.revenue - totalKambing.cogs).toLocaleString()}`);
  console.log(`Margin: ${totalKambing.revenue ? ((totalKambing.revenue - totalKambing.cogs) / totalKambing.revenue * 100).toFixed(2) : 0}%`);

  console.log('\nKAMBING BREAKDOWN:');
  for (const [key, stats] of Object.entries(kambingCategories)) {
    console.log(`  ${key}: Qty=${stats.qty}, Revenue=Rp ${stats.revenue.toLocaleString()}, Profit=Rp ${(stats.revenue - stats.cogs).toLocaleString()} (Margin: ${stats.revenue ? ((stats.revenue - stats.cogs) / stats.revenue * 100).toFixed(2) : 0}%)`);
  }
}

run();
