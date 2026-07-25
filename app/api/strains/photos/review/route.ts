import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Admin review queue for community-submitted grow photos -- mirrors
// /api/strains/review exactly (service-role client, re-checks is_admin on
// every call) so a submitted photo never shows publicly until a human
// confirms it's a real, appropriate photo of that strain.

const POINTS_FOR_VERIFIED_PHOTO = 15;

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
      .from('strain_photos')
      .select('*, strains(name, slug)')
      .eq('verification_status', 'pending')
      .order('created_at', { ascending: true });

    const submitterIds = Array.from(new Set((pending || []).map((p: any) => p.submitted_by).filter(Boolean)));
    let submitters: Record<string, { name: string | null; email: string | null }> = {};
    if (submitterIds.length > 0) {
      const { data: profiles } = await admin.from('profiles').select('id, name, email').in('id', submitterIds);
      submitters = Object.fromEntries((profiles || []).map((p: any) => [p.id, { name: p.name, email: p.email }]));
    }

    const photos = (pending || []).map((p: any) => ({
      ...p,
      submitter: submitters[p.submitted_by] || null,
    }));

    return NextResponse.json({ photos });
  } catch (err: any) {
    console.error('photo review GET error', err);
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
    const photoId: string = body?.photoId;
    const action: string = body?.action;
    if (!photoId || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'photoId and a valid action are required.' }, { status: 400 });
    }

    const { data: photo } = await admin
      .from('strain_photos')
      .select('id, submitted_by, verification_status')
      .eq('id', photoId)
      .eq('verification_status', 'pending')
      .maybeSingle();

    if (!photo) {
      return NextResponse.json({ error: 'That photo is no longer pending review.' }, { status: 404 });
    }

    if (action === 'approve') {
      const { error } = await admin.from('strain_photos').update({ verification_status: 'verified' }).eq('id', photoId);
      if (error) return NextResponse.json({ error: error.message }, { status: 500 });

      await admin.rpc('increment_points', { target_user: photo.submitted_by, amount: POINTS_FOR_VERIFIED_PHOTO });
      return NextResponse.json({ ok: true, awardedPoints: POINTS_FOR_VERIFIED_PHOTO });
    }

    // reject -- pull the row; the underlying storage object is left in
    // place (cheap, and useful for a future abuse audit) but nothing ever
    // links to it once the row is gone.
    const { error } = await admin.from('strain_photos').delete().eq('id', photoId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('photo review POST error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
