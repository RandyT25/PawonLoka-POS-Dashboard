import { createClient } from './node_modules/@supabase/supabase-js/dist/index.cjs';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function check() {
  const { data } = await supabase.from('ingredients').select('name, stock').lt('stock', 0);
  console.log('Negative stock items:', data);
}
check();
