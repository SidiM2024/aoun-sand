import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_bzMOKDOqC0dR8Ec_DAKZMA_13wY-oVl';

export const supabase = createClient(supabaseUrl, supabaseKey);
