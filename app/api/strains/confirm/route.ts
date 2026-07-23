import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { slugify } from '@/lib/fuzzy';
import { StrainType } from '@/lib/types';

export const runtime = 'nodejs';

// AI Strain Finder, step 2: confirm. Only runs after the person has looked
// at the researched candidate from /api/strains/research and said "yes,
// that's it" -- this is the only place a community-sourced strain actually
// gets written to the database, and it always lands as
// source=community_find, verification_status=pending. It shows up on its
// own page immediately (with a disclaimer + "pending review" note and
// credit to whoever found it) but stays out of general browse/search until
// an admin verifies it in /admin/strains.

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

const VALID_TYPES: StrainType[] = ['Indica', 'Sativa', 'Hybrid'];

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const body = await req.json();
    const candidate = body?.candidate;
    const sources = Array.isArray(body?.sources) ? body.sources.slice(0, 5) : [];

    if (!candidate?.name || !VALID_TYPES.includes(candidate.type)) {
      return NextResponse.json({ error: 'Invalid candidate data.' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const baseSlug = slugify(String(candidate.name));
    if (!baseSlug) return NextResponse.json({ error: 'Could not generate a slug for that name.' }, { status: 400 });

    // Dedupe the slug against whatever already exists.
    const { data: existingSlugs } = await admin.from('strains').select('slug').ilike('slug', `${baseSlug}%`);
    const taken = new Set((existingSlugs || []).map((s: any) => s.slug));
    let slug = baseSlug;
    let n = 2;
    while (taken.has(slug)) {
      slug = `${baseSlug}-${n}`;
      n++;
    }

    const effects = Array.isArray(candidate.effects) ? candidate.effects.slice(0, 4).map(String) : [];
    const symptoms = Array.isArray(candidate.symptoms) ? candidate.symptoms.slice(0, 4).map(String) : [];
    const terpenes = Array.isArray(candidate.terpenes)
      ? candidate.terpenes
          .slice(0, 3)
          .map((t: any) => ({ name: String(t.name), percentage: Number(t.percentage) || 0 }))
      : [];

    const { data: inserted, error } = await admin
      .from('strains')
      .insert({
        slug,
        name: String(candidate.name).slice(0, 120),
        type: candidate.type,
        thc: Number(candidate.thc) || 0,
        cbd: Number(candidate.cbd) || 0,
        description: String(candidate.description || '').slice(0, 600),
        effects,
        symptoms,
        terpenes,
        rating: 0,
        review_count: 0,
        featured: false,
        source: 'community_find',
        verification_status: 'pending',
        found_by_user_id: user.id,
        research_sources: sources,
      })
      .select('slug')
      .single();

    if (error) {
      console.error('strain confirm insert error', error);
      return NextResponse.json({ error: 'Could not save that strain.' }, { status: 500 });
    }

    return NextResponse.json({ ok: true, slug: inserted?.slug || slug });
  } catch (err: any) {
    console.error('strain confirm route error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
