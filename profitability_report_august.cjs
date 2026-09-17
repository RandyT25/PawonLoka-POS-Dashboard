const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.VITE_SUPABASE_ANON_KEY
);

async function run() {
  const { data: products } = await supabase.from('products').select('name, cogs');
  const cogsMap = {};
  if (products) {
    products.forEach(p => {
      cogsMap[p.name.toLowerCase()] = p.cogs || 0;
    });
  }

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

  const paidOrders = allOrders.filter(o => {
    if (o.status !== 'Paid' && o.status !== 'paid') return false;
    const d = new Date(o.created_at);
    // Filter for August 2026
    return d.getFullYear() === 2026 && d.getMonth() === 7; // getMonth() is 0-indexed, 7 is August
  });

  const ayamStats = { qty: 0, revenue: 0, cogs: 0 };
  
  const kambingCategories = {
    'Sop Iga Kambing': { qty: 0, revenue: 0, cogs: 0 },
    'Tengkleng Rica': { qty: 0, revenue: 0, cogs: 0 },
    'Tongseng': { qty: 0, revenue: 0, cogs: 0 },
    'Other Kambing': { qty: 0, revenue: 0, cogs: 0 }
  };
  let totalKambing = { qty: 0, revenue: 0, cogs: 0 };

  paidOrders.forEach(o => {
    const raw = o.items || [];
    const items = typeof raw === 'string' ? JSON.parse(raw || '[]') : (raw || []);

    items.forEach(i => {
      const name = i.name || '';
      const nameLower = name.toLowerCase();
      const qty = Number(i.qty || 1);
      const price = Number(i.price || 0) * qty;
      const itemCogs = Number(i.cogs) > 0 ? Number(i.cogs) : (cogsMap[nameLower] || 0);
      const cogs = itemCogs * qty;

      if (nameLower.includes('ayam')) {
        ayamStats.qty += qty;
        ayamStats.revenue += price;
        ayamStats.cogs += cogs;
      }
      
      const isKambing = nameLower.includes('kambing') || nameLower.includes('tongseng') || nameLower.includes('iga') || nameLower.includes('tengkleng');
      
      if (isKambing) {
        if (nameLower.includes('sapi')) return;

        totalKambing.qty += qty;
        totalKambing.revenue += price;
        totalKambing.cogs += cogs;

        if (nameLower.includes('sop iga') || (nameLower.includes('iga') && !nameLower.includes('tengkleng'))) {
          kambingCategories['Sop Iga Kambing'].qty += qty;
          kambingCategories['Sop Iga Kambing'].revenue += price;
          kambingCategories['Sop Iga Kambing'].cogs += cogs;
        } else if (nameLower.includes('tengkleng') || nameLower.includes('rica')) {
          kambingCategories['Tengkleng Rica'].qty += qty;
          kambingCategories['Tengkleng Rica'].revenue += price;
          kambingCategories['Tengkleng Rica'].cogs += cogs;
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

  console.log('--- AUGUST 2026 PROFITABILITY REPORT ---');
  
  const ayamProfit = ayamStats.revenue - ayamStats.cogs;
  const kambingProfit = totalKambing.revenue - totalKambing.cogs;

  console.log('\nAYAM STATS:');
  console.log(`Total Qty: ${ayamStats.qty}`);
  console.log(`Total Revenue: Rp ${ayamStats.revenue.toLocaleString()}`);
  console.log(`Total COGS: Rp ${ayamStats.cogs.toLocaleString()}`);
  console.log(`Gross Profit: Rp ${ayamProfit.toLocaleString()}`);
  console.log(`Margin: ${ayamStats.revenue ? (ayamProfit / ayamStats.revenue * 100).toFixed(2) : 0}%`);

  console.log('\nTOTAL KAMBING STATS:');
  console.log(`Total Qty: ${totalKambing.qty}`);
  console.log(`Total Revenue: Rp ${totalKambing.revenue.toLocaleString()}`);
  console.log(`Total COGS: Rp ${totalKambing.cogs.toLocaleString()}`);
  console.log(`Gross Profit: Rp ${kambingProfit.toLocaleString()}`);
  console.log(`Margin: ${totalKambing.revenue ? (kambingProfit / totalKambing.revenue * 100).toFixed(2) : 0}%`);

  console.log('\n--- DIFFERENCE (AYAM vs KAMBING) ---');
  console.log(`Revenue Diff (Ayam - Kambing): Rp ${(ayamStats.revenue - totalKambing.revenue).toLocaleString()}`);
  console.log(`COGS Diff (Ayam - Kambing): Rp ${(ayamStats.cogs - totalKambing.cogs).toLocaleString()}`);
  console.log(`Profit Diff (Ayam - Kambing): Rp ${(ayamProfit - kambingProfit).toLocaleString()}`);

  console.log('\nKAMBING BREAKDOWN:');
  for (const [key, stats] of Object.entries(kambingCategories)) {
    const profit = stats.revenue - stats.cogs;
    console.log(`  ${key}: Qty=${stats.qty}, Revenue=Rp ${stats.revenue.toLocaleString()}, COGS=Rp ${stats.cogs.toLocaleString()}, Profit=Rp ${profit.toLocaleString()} (Margin: ${stats.revenue ? (profit / stats.revenue * 100).toFixed(2) : 0}%)`);
  }
}

run();
