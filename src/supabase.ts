import { createClient } from '@supabase/supabase-js';

// Load Supabase environment variables
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null;

export function isSupabaseConfigured(): boolean {
  return !!supabase;
}

console.log('Supabase initialization status:', isSupabaseConfigured() ? 'CONFIGURED' : 'NOT CONFIGURED');
