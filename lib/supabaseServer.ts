import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from './supabaseConfig';

// Simple server-side client for read-only queries in Route Handlers /
// Server Components. Uses the public anon key -- fine here because every
// table this touches is protected by RLS policies that already allow
// public reads (strains, dispensaries, dispensary_products).
export function createServerReadClient() {
  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false },
  });
}
