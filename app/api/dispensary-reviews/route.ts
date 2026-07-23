import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Dispensary-level reviews (as opposed to strain reviews) -- the trust
// signal shoppers actually look for on Weedmaps/Leafly before ordering from
// a specific shop, not just whether a strain is good. Mirrors /api/reviews'
// pattern: first review of a given dispensary earns +5 points, re-reviewing
// just updates it.

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) {
      return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    }

    const body = await req.json();
    const dispensaryId: string = body?.dispensaryId;
    const rating: number = Number(body?.rating);
    const reviewBody: string = (body?.body || '').toString().slice(0, 2000);

    if (!dispensaryId || !rating || rating < 1 || rating > 5) {
      return NextResponse.json({ error: 'dispensaryId and a rating 1-5 are required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) {
      return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
    }

    const { data: existing } = await admin
      .from('dispensary_reviews')
      .select('id')
      .eq('dispensary_id', dispensaryId)
      .eq('user_id', user.id)
      .maybeSingle();

    const { error: upsertError } = await admin
      .from('dispensary_reviews')
      .upsert(
        { dispensary_id: dispensaryId, user_id: user.id, rating, body: reviewBody || null },
        { onConflict: 'dispensary_id,user_id' }
      );

    if (upsertError) {
      return NextResponse.json({ error: upsertError.message }, { status: 500 });
    }

    if (!existing) {
      await admin.rpc('increment_points', { target_user: user.id, amount: 5 });
    }

    return NextResponse.json({ ok: true, awardedPoints: !existing ? 5 : 0 });
  } catch (err: any) {
    console.error('dispensary reviews route error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
