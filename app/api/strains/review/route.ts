import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Admin review queue for AI Strain Finder submissions. Everything here --
// listing pending strains, approving, rejecting -- runs through the
// service-role admin client and re-checks profiles.is_admin server-side on
// every call, rather than relying on RLS + a client-side query, so a stray
// policy change can't accidentally expose the review queue or another
// user's profile data.

const POINTS_FOR_VERIFIED_FIND = 50;

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

export async function GET(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

    const { data: pending } = await admin
      .from('strains')
      .select('*')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true });

    const finderIds = Array.from(new Set((pending || []).map((s: any) => s.found_by_user_id).filter(Boolean)));
    let finders: Record<string, { name: string | null; email: string | null }> = {};
    if (finderIds.length > 0) {
      const { data: profiles } = await admin.from('profiles').select('id, name, email').in('id', finderIds);
      finders = Object.fromEntries((profiles || []).map((p: any) => [p.id, { name: p.name, email: p.email }]));
    }

    const strains = (pending || []).map((s: any) => ({
      ...s,
      finder: s.found_by_user_id ? finders[s.found_by_user_id] || null : null,
    }));

    return NextResponse.json({ strains });
  } catch (err: any) {
    console.error('strain review GET error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

    const body = await req.json();
    const strainId: string = body?.strainId;
    const action: string = body?.action;
    if (!strainId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'strainId and a valid action are required.' }, { status: 400 });
    }

    const { data: strain } = await admin
      .from('strains')
      .select('id, name, slug, found_by_user_id, verification_status')
      .eq('id', strainId)
      .eq('verification_status', 'pending')
      .maybeSingle();

    if (!strain) {
      return NextResponse.json({ error: 'That strain is no longer pending review.' }, { status: 404 });
    }

    if (action === 'approve') {
      const { error } = await admin.from('strains').update({ verification_status: 'verified' }).eq('id', strainId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      if (strain.found_by_user_id) {
        await admin.rpc('increment_points', { target_user: strain.found_by_user_id, amount: POINTS_FOR_VERIFIED_FIND });
        await admin.from('notifications').insert({
          user_id: strain.found_by_user_id,
          type: 'strain_verified',
          title: `${strain.name} was verified!`,
          body: `Your AI Strain Finder submission is now live and you earned ${POINTS_FOR_VERIFIED_FIND} points.`,
          link: `/strains/${strain.slug}`,
        });
      }
      return NextResponse.json({ ok: true, awardedPoints: strain.found_by_user_id ? POINTS_FOR_VERIFIED_FIND : 0 });
    }

    // reject -- a rejected AI find isn't worth keeping around in any state,
    // so it's removed outright rather than left as dead "rejected" rows.
    // Notify first, while the row (and its name) still exists.
    if (strain.found_by_user_id) {
      await admin.from('notifications').insert({
        user_id: strain.found_by_user_id,
        type: 'strain_rejected',
        title: `${strain.name} wasn't verified`,
        body: "An admin reviewed your submission and it didn't get added to the catalog this time.",
        link: null,
      });
    }
    const { error } = await admin.from('strains').delete().eq('id', strainId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('strain review POST error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
