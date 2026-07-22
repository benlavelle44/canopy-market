import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL } from './supabaseConfig';

// Service-role client for trusted server contexts only (e.g. the Stripe
// webhook, which needs to update a dispensary's tier regardless of who
// owns it). Requires SUPABASE_SERVICE_ROLE_KEY to be set as a Vercel env
// var -- find it in Supabase dashboard > Settings > API. Never import this
// in client code or expose the key to the browser.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) return null;
  return createSupabaseClient(SUPABASE_URL, key, {
    auth: { persistSession: false },
  });
}
