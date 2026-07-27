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
// the dispensary's own owner can request its insights, and only Verified
// tier dispensaries get the full breakdown (Free and Pro both get a locked
// teaser) -- this is the flagship perk that justifies Verified's price gap
// over Pro.

const MIN_LOCAL_SAMPLE = 5;

// Price bands for flower listings. These are deliberately simple, roughly
// eighth-ounce-scale bands ($ per listed unit as entered by the dispensary)
// -- good enough to flag a directional mismatch between what's stocked and
// what's wanted, not meant as a precise market-price index.
type PriceTier = 'budget' | 'mid' | 'premium';
function tierOf(price: number): PriceTier {
  if (price < 30) return 'budget';
  if (price <= 55) return 'mid';
  return 'premium';
}
function emptyTierCounts(): Record<PriceTier, number> {
  return { budget: 0, mid: 0, premium: 0 };
}
function toPercentages(counts: Record<PriceTier, number>) {
  const total = counts.budget + counts.mid + counts.premium;
  if (total === 0) return { budget: 0, mid: 0, premium: 0, total: 0 };
  return {
    budget: Math.round((counts.budget / total) * 100),
    mid: Math.round((counts.mid / total) * 100),
    premium: Math.round((counts.premium / total) * 100),
    total,
  };
}

interface PriceTierMix {
  own: ReturnType<typeof toPercentages>;
  demand: ReturnType<typeof toPercentages>;
  insight: string | null;
}

async function buildPriceTierMix(
  admin: ReturnType<typeof createAdminClient>,
  dispensaryId: string,
  ownFlowerProducts: { strain_id: string | null; price: number | null }[],
  favCounts: Record<string, number>
): Promise<PriceTierMix | null> {
  if (!admin) return null;

  // Own menu's price-tier distribution.
  const ownCounts = emptyTierCounts();
  for (const p of ownFlowerProducts) {
    if (p.price === null || p.price === undefined) continue;
    ownCounts[tierOf(Number(p.price))]++;
  }

  // Platform-wide average listed price per strain (approved dispensaries
  // only), used to price what members are favoriting.
  const { data: platformFlower } = await admin
    .from('products')
    .select('strain_id, price, dispensaries!inner(status)')
    .eq('category', 'flower')
    .eq('dispensaries.status', 'approved')
    .not('price', 'is', null)
    .not('strain_id', 'is', null);

  const priceSum: Record<string, { sum: number; count: number }> = {};
  for (const row of platformFlower || []) {
    const sid = (row as any).strain_id;
    const price = Number((row as any).price);
    if (!sid || !Number.isFinite(price)) continue;
    if (!priceSum[sid]) priceSum[sid] = { sum: 0, count: 0 };
    priceSum[sid].sum += price;
    priceSum[sid].count += 1;
  }

  const demandCounts = emptyTierCounts();
  for (const [sid, favCount] of Object.entries(favCounts)) {
    const avg = priceSum[sid];
    if (!avg || avg.count === 0) continue; // no platform pricing data for this strain yet
    const avgPrice = avg.sum / avg.count;
    demandCounts[tierOf(avgPrice)] += favCount;
  }

  const own = toPercentages(ownCounts);
  const demand = toPercentages(demandCounts);

  let insight: string | null = null;
  if (own.total >= 3 && demand.total >= MIN_LOCAL_SAMPLE) {
    const premiumGap = own.premium - demand.premium;
    const budgetGap = demand.budget - own.budget;
    if (premiumGap >= 20 && budgetGap >= 15) {
      insight = `Your menu skews premium (${own.premium}% of flower vs. ${demand.premium}% of what members favorite), while budget demand (${demand.budget}%) is underrepresented on your shelves (${own.budget}%). That gap in high-end stock can sit and age while cheaper picks sell through -- worth testing a few more budget-tier SKUs.`;
    } else if (budgetGap <= -20 && premiumGap <= -15) {
      insight = `Your menu skews budget (${own.budget}% of flower vs. ${demand.budget}% of what members favorite), while premium demand (${demand.premium}%) is underrepresented on your shelves (${own.premium}%). Members in your area are favoriting higher-end strains you may be able to carry at a better margin.`;
    }
  }

  return { own, demand, insight };
}

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

    if (tier !== 'verified') {
      // Teaser only -- no strain-level detail, just proof there's signal.
      // Applies to both Free and Pro now; full insights are Verified-only.
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
      .select('strain_id, price')
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

    // Price-tier mix: is this dispensary's own flower menu skewed toward a
    // price tier that local demand doesn't actually support? Demand-side
    // tier comes from what members are favoriting, priced using each
    // strain's platform-wide average listed price (not this dispensary's
    // own price for it) -- so it reflects what people want, not what this
    // dispensary happens to charge.
    const priceTierMix = await buildPriceTierMix(admin, dispensaryId, existingProducts || [], favCounts);

    return NextResponse.json({
      locked: false,
      tier,
      sampleSize,
      platformWide,
      topOpportunities: scored,
      tasteProfile,
      priceTierMix,
    });
  } catch (err: any) {
    console.error('demand insights route error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
