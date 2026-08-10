import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { STATE_COOKIE, SUPPORTED_STATES } from '@/lib/shopperState';

// Saves the shopper's confirmed state as a 1-year cookie so every
// state-scoped Server Component (home, /shop, /dispensaries, strain
// "Available at", the AI budtender) reads the same value without
// re-prompting on every page load. If the caller is signed in, also saves
// it to profiles.state so it carries across devices/browsers -- mirrors
// the getUserFromRequest bearer-token pattern already used in
// app/api/assistant/route.ts, since Route Handlers don't share the
// browser's Supabase auth session automatically.
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const state = String(body?.state || '').toUpperCase();
  if (!SUPPORTED_STATES.includes(state)) {
    return NextResponse.json({ error: 'Unsupported state' }, { status: 400 });
  }

  const store = await cookies();
  store.set(STATE_COOKIE, state, {
    path: '/',
    maxAge: 60 * 60 * 24 * 365,
    sameSite: 'lax',
  });

  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (token) {
    const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data } = await supabase.auth.getUser(token);
    const admin = createAdminClient();
    if (data.user && admin) {
      await admin.from('profiles').update({ state }).eq('id', data.user.id);
    }
  }

  return NextResponse.json({ ok: true });
}
