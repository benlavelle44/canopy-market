import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Owner responses used to be a direct client-side update (fine for the
// write itself, since RLS already restricts it to the dispensary's real
// owner) -- moved behind a route so we can also notify the original
// reviewer server-side, which requires writing to another user's row and
// can't be done safely from the browser.

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
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const body = await req.json();
    const reviewId: string = body?.reviewId;
    const response: string = (body?.response || '').toString().trim().slice(0, 2000);
    if (!reviewId || !response) {
      return NextResponse.json({ error: 'reviewId and response are required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: review } = await admin
      .from('dispensary_reviews')
      .select('id, user_id, dispensary_id, dispensaries(name, slug, owner_id)')
      .eq('id', reviewId)
      .maybeSingle();

    if (!review) return NextResponse.json({ error: 'Review not found.' }, { status: 404 });
    const dispensary = (review as any).dispensaries as { name: string; slug: string; owner_id: string | null } | null;

    if (!dispensary || dispensary.owner_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this dispensary.' }, { status: 403 });
    }

    const { error } = await admin
      .from('dispensary_reviews')
      .update({ owner_response: response, owner_response_at: new Date().toISOString() })
      .eq('id', reviewId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    await admin.from('notifications').insert({
      user_id: (review as any).user_id,
      type: 'review_reply',
      title: `${dispensary.name} responded to your review`,
      body: response.slice(0, 200),
      link: `/dispensaries/${dispensary.slug}`,
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('dispensary review reply error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
