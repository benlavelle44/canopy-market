import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Claims a referral code for the *currently signed in* user (a brand new
// signup). Awards the referrer +20 points, once. Safe to call more than
// once -- it's a no-op if this user already has a referred_by set.
export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const body = await req.json();
    const code: string = (body?.code || '').toString().trim();
    if (!code) {
      return NextResponse.json({ error: 'code is required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
    }

    const { data: me } = await admin.from('profiles').select('id, referred_by').eq('id', user.id).maybeSingle();
    if (!me) {
      return NextResponse.json({ error: 'Profile not found.' }, { status: 404 });
    }
    if (me.referred_by) {
      return NextResponse.json({ ok: true, alreadyClaimed: true });
    }

    const { data: referrer } = await admin
      .from('profiles')
      .select('id')
      .eq('referral_code', code)
      .maybeSingle();

    if (!referrer) {
      return NextResponse.json({ error: 'Invalid referral code.' }, { status: 404 });
    }
    if (referrer.id === user.id) {
      return NextResponse.json({ error: "You can't refer yourself." }, { status: 400 });
    }

    await admin.from('profiles').update({ referred_by: referrer.id }).eq('id', user.id);
    await admin.rpc('increment_points', { target_user: referrer.id, amount: 20 });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('referral claim error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
