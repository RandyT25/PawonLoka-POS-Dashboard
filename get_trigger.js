import { createClient } from './node_modules/@supabase/supabase-js/dist/index.cjs';
import fs from 'fs';

const env = fs.readFileSync('.env', 'utf-8');
const urlMatch = env.match(/VITE_SUPABASE_URL=(.*)/);
const keyMatch = env.match(/VITE_SUPABASE_ANON_KEY=(.*)/);

const supabase = createClient(urlMatch[1], keyMatch[1]);

async function trace() {
  const { data, error } = await supabase.rpc('get_schema_info'); // if exists
  console.log("Checking trigger logic in Supabase...");
}
trace();
