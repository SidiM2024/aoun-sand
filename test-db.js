import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.VITE_SUPABASE_ANON_KEY);

async function check() {
  const { data, error } = await supabase.from('site_settings').select('*');
  console.log("Settings:", JSON.stringify(data, null, 2));
  console.log("Error:", error);
}
check();
