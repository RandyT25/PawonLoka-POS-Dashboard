import { createClient } from './node_modules/@supabase/supabase-js/dist/index.cjs';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function trace() {
  const { data: ing } = await supabase.from('ingredients').select('id, name').eq('name', 'Bihun Cooked').single();
  if (!ing) return console.log('Bihun Cooked not found');
  
  const { data: movs, error } = await supabase.from('stock_movements')
    .select('*')
    .eq('ingredient_id', ing.id)
    .order('created_at', { ascending: false })
    .limit(10);
    
  if (error) console.error(error);
  else console.log(movs);
}
trace();
