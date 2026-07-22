import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Local Demand Insights: aggregates anonymous favorites + ratings from
// Canopy members (optionally scoped to a dispensary's state, when enough
// members have voluntarily shared their location) into "what to stock"
// signals for dispensary owners. This route NEVER returns individual user
// identities -- only counts, averages, and strain-level aggregates. Only
// the dispensary's own owner can request its insights, and only Pro /
// Verified tier dispensaries get the full breakdown (Free tier gets a
// locked teaser) -- this is a paid-tier feature.

const MIN_LOCAL_SAMPLE = 5;

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
    const dispensaryId: string = body?.dispensaryId;
    if (!dispensaryId) return NextResponse.json({ error: 'dispensaryId is required.' }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: dispensary } = await admin
      .from('dispensaries')
      .select('id, owner_id, state, tier')
      .eq('id', dispensaryId)
      .maybeSingle();

    if (!dispensary || dispensary.owner_id !== user.id) {
      return NextResponse.json({ error: 'Not found.' }, { status: 404 });
    }

    const tier = dispensary.tier || 'free';

    // Figure out the local member pool: those who've voluntarily shared a
    // matching state. Falls back to the whole platform if too few have.
    let profileIds: string[] = [];
    let platformWide = true;

    if (dispensary.state) {
      const { data: localProfiles } = await admin
        .from('profiles')
        .select('id')
        .ilike('state', dispensary.state);
      if ((localProfiles || []).length >= MIN_LOCAL_SAMPLE) {
        profileIds = localProfiles!.map((p: any) => p.id);
        platformWide = false;
      }
    }

    if (platformWide) {
      const { data: allProfiles } = await admin.from('profiles').select('id');
      profileIds = (allProfiles || []).map((p: any) => p.id);
    }

    const sampleSize = profileIds.length;
    const safeIds = profileIds.length ? profileIds : ['00000000-0000-0000-0000-000000000000'];

    if (tier === 'free') {
      // Teaser only -- no strain-level detail, just proof there's signal.
      const { data: favTeaser } = await admin
        .from('favorites')
        .select('strain_id')
        .in('user_id', safeIds);
      return NextResponse.json({
        locked: true,
        tier,
        sampleSize,
        platformWide,
        favoriteSignalCount: (favTeaser || []).length,
      });
    }

    // Existing menu strain ids for this dispensary, so we only surface gaps.
    const { data: existingProducts } = await admin
      .from('products')
      .select('strain_id')
      .eq('dispensary_id', dispensaryId)
      .eq('category', 'flower');
    const ownedStrainIds = new Set((existingProducts || []).map((p: any) => p.strain_id).filter(Boolean));

    const [{ data: favorites }, { data: reviews }] = await Promise.all([
      admin
        .from('favorites')
        .select('strain_id, strains(id, name, slug, type, terpenes)')
        .in('user_id', safeIds),
      admin
        .from('reviews')
        .select('strain_id, rating')
        .in('user_id', safeIds),
    ]);

    const favCounts: Record<string, number> = {};
    const strainMeta: Record<string, { name: string; slug: string; type: string; terpenes: any[] }> = {};
    for (const row of favorites || []) {
      const sid = (row as any).strain_id;
      if (!sid) continue;
      favCounts[sid] = (favCounts[sid] || 0) + 1;
      const s = (row as any).strains;
      if (s && !strainMeta[sid]) {
        strainMeta[sid] = { name: s.name, slug: s.slug, type: s.type, terpenes: s.terpenes || [] };
      }
    }

    const reviewAgg: Record<string, { sum: number; count: number }> = {};
    for (const row of reviews || []) {
      const sid = (row as any).strain_id;
      if (!sid) continue;
      if (!reviewAgg[sid]) reviewAgg[sid] = { sum: 0, count: 0 };
      reviewAgg[sid].sum += Number((row as any).rating) || 0;
      reviewAgg[sid].count += 1;
    }

    const allStrainIds = new Set([...Object.keys(favCounts), ...Object.keys(reviewAgg)]);
    const scored = Array.from(allStrainIds)
      .filter((sid) => !ownedStrainIds.has(sid))
      .map((sid) => {
        const favCount = favCounts[sid] || 0;
        const rv = reviewAgg[sid];
        const avgRating = rv ? rv.sum / rv.count : 0;
        const reviewCount = rv?.count || 0;
        const score = favCount * 2 + avgRating * reviewCount * 0.5;
        return {
          strainId: sid,
          name: strainMeta[sid]?.name || null,
          slug: strainMeta[sid]?.slug || null,
          type: strainMeta[sid]?.type || null,
          favoriteCount: favCount,
          avgRating: avgRating ? Math.round(avgRating * 10) / 10 : null,
          reviewCount,
          score,
        };
      })
      .filter((x) => x.name && x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 8);

    // Aggregate "local taste profile" -- which terpenes show up most across
    // everything members have favorited, weighted by how many favorited it.
    const terpeneWeight: Record<string, number> = {};
    for (const sid of Object.keys(favCounts)) {
      const meta = strainMeta[sid];
      if (!meta) continue;
      for (const t of meta.terpenes) {
        const pct = Number(t.percentage) || 0;
        terpeneWeight[t.name] = (terpeneWeight[t.name] || 0) + pct * favCounts[sid];
      }
    }
    const tasteProfile = Object.entries(terpeneWeight)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name);

    return NextResponse.json({
      locked: false,
      tier,
      sampleSize,
      platformWide,
      topOpportunities: scored,
      tasteProfile,
    });
  } catch (err: any) {
    console.error('demand insights route error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
