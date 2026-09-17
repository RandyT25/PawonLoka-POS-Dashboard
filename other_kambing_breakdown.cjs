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

  const paidOrders = allOrders.filter(o => o.status === 'Paid' || o.status === 'paid');

  const otherKambingItems = {};

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

      const isKambing = nameLower.includes('kambing') || nameLower.includes('tongseng') || nameLower.includes('iga') || nameLower.includes('tengkleng');
      
      if (isKambing) {
        if (nameLower.includes('sapi')) return;

        const isSopIga = nameLower.includes('sop iga') || (nameLower.includes('iga') && !nameLower.includes('tengkleng'));
        const isTengklengRica = nameLower.includes('tengkleng') || nameLower.includes('rica');
        const isTongseng = nameLower.includes('tongseng');

        if (!isSopIga && !isTengklengRica && !isTongseng) {
          if (!otherKambingItems[name]) {
            otherKambingItems[name] = { qty: 0, revenue: 0, cogs: 0 };
          }
          otherKambingItems[name].qty += qty;
          otherKambingItems[name].revenue += price;
          otherKambingItems[name].cogs += cogs;
        }
      }
    });
  });

  console.log('--- "OTHER KAMBING" BREAKDOWN (ALL TIME) ---');
  for (const [name, stats] of Object.entries(otherKambingItems).sort((a,b) => b[1].qty - a[1].qty)) {
    const profit = stats.revenue - stats.cogs;
    console.log(`- ${name}: Qty=${stats.qty}, Revenue=Rp ${stats.revenue.toLocaleString()}, COGS=Rp ${stats.cogs.toLocaleString()}, Profit=Rp ${profit.toLocaleString()} (Margin: ${stats.revenue ? (profit / stats.revenue * 100).toFixed(2) : 0}%)`);
  }
}

run();
