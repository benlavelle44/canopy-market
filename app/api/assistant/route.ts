import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerReadClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getShopperState } from '@/lib/shopperState';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { heuristicRecommend, heuristicReply, reasonForMatch } from '@/lib/recommend';
import { extractTrailingJson, extractAllText } from '@/lib/extractJson';
import { Strain, Concentrate, Edible } from '@/lib/types';

export const runtime = 'nodejs';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
}

type PickType = 'strain' | 'concentrate' | 'edible';

interface RawPick {
  type: string;
  slug: string;
  reason: string;
}

interface ResolvedPick {
  type: PickType;
  id: string;
  slug: string;
  name: string;
  subtitle: string;
  reason: string;
  href: string;
}

interface AvailabilityItem {
  name: string;
  slug: string;
  price: number | null;
  city: string;
  state: string;
}

// Best-effort caller identity -- the assistant works fully signed-out, this
// just unlocks personalization (skipping/flagging strains the person has
// already rated poorly) when a token is present.
async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

function mapRow(row: any): Strain {
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    type: row.type,
    thc: Number(row.thc),
    cbd: Number(row.cbd),
    description: row.description,
    effects: row.effects || [],
    symptoms: row.symptoms || [],
    terpenes: row.terpenes || [],
    rating: Number(row.rating),
    review_count: row.review_count,
    featured: row.featured,
  };
}

// This used to always recommend on the very first message -- more of a
// vending machine than a budtender. A real budtender asks a quick question
// or two first (what format, new to this or experienced, what's the goal)
// before pointing at a shelf. Claude now returns one of two "modes" instead
// of always jumping to recommendations: "clarify" (one short question, no
// picks yet) or "recommend" (2-4 real picks with reasons). The prompt caps
// this at a single clarifying round -- it's told to check its own past
// turns in the conversation and never ask twice.
async function callClaude(
  message: string,
  history: ChatTurn[],
  strains: Strain[],
  concentrates: Concentrate[],
  edibles: Edible[],
  historyDigest: string | null
): Promise<{ mode: 'clarify' | 'recommend'; reply: string; picks: RawPick[] } | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const strainCatalog = strains
    .map(
      (s) =>
        `${s.slug} | type:strain | ${s.name} | ${s.type} | THC ${s.thc}% CBD ${s.cbd}% | effects: ${s.effects.join(', ')} | helps with: ${s.symptoms.join(', ')}`
    )
    .join('\n');

  const concentrateCatalog = concentrates
    .map(
      (c) =>
        `${c.slug} | type:concentrate | ${c.name} | ${c.category} | ${c.typical_thc_range || 'THC varies'} | effects: ${c.effects.join(', ')} | best for: ${c.best_for.join(', ')}${c.beginner_friendly ? ' | [beginner-friendly]' : ''}`
    )
    .join('\n');

  const edibleCatalog = edibles
    .map(
      (e) =>
        `${e.slug} | type:edible | ${e.name} | ${e.category} | ${e.dosage_mg != null ? `${e.dosage_mg}mg THC` : 'dose varies'} | effects: ${e.effects.join(', ')} | best for: ${e.best_for.join(', ')}${e.beginner_friendly ? ' | [beginner-friendly]' : ''}`
    )
    .join('\n');

  const personalization = historyDigest
    ? `\nThis shopper's past ratings on Canopy: ${historyDigest}. Lean toward items similar in effects/type to ones they rated 4-5 stars. Avoid recommending something they rated 2 stars or below unless nothing else fits -- and if you do include or skip one for this reason, say so briefly in its "reason".`
    : '';

  const system = `You are the AI budtender for Canopy Market, a cannabis marketplace covering flower strains, concentrates/dabs, and edibles/tinctures/topicals. You help people find products for how they want to feel or symptoms they want relief from. You are NOT a doctor and must never give medical advice or dosing instructions -- keep guidance general and always suggest starting low and going slow, and suggest consulting a doctor for medical conditions.

You work in one of two modes, and must pick exactly one per reply:

"clarify" -- Use this ONLY on your first reply in a conversation, and ONLY if you're genuinely missing something that would change your answer: their desired outcome/feeling, whether they're new to cannabis or experienced, or a format preference (flower, dab/concentrate, edible, tincture, topical, or no preference). Ask ONE short, friendly, specific question covering the single biggest gap -- never a list of questions. Look back through the conversation history below: if you already asked a clarifying question earlier in this conversation, you MUST use "recommend" this turn instead, no matter how incomplete the picture still is -- never ask twice.

"recommend" -- Pick 2-4 real items from the catalogs below. Mix formats (strain/concentrate/edible) when it makes sense for the request; stay within one format only if the shopper specified one. Every pick needs its own short, specific reason -- never generic or blank. If the shopper indicated they're new/inexperienced, prefer items marked [beginner-friendly] and say so.

Only recommend items from these exact catalogs (never invent products):

FLOWER STRAINS:
${strainCatalog}

CONCENTRATES / DABS:
${concentrateCatalog}

EDIBLES / TINCTURES / TOPICALS:
${edibleCatalog}
${personalization}

Respond ONLY with valid JSON, no markdown fences, matching exactly one of these two shapes:
{"mode": "clarify", "reply": "your one short question"}
{"mode": "recommend", "reply": "a warm, concise 2-4 sentence response", "recommendations": [{"type": "strain", "slug": "slug1", "reason": "under 12 words, specific to this item and this request"}]}`;

  const messages = [
    ...history.slice(-6).map((h) => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 600,
      system,
      messages,
    }),
  });

  if (!res.ok) {
    console.error('Anthropic API error', res.status, await res.text());
    return null;
  }

  const data = await res.json();
  const text = extractAllText(data?.content);
  try {
    const parsed = extractTrailingJson(text);
    if (!parsed.reply) return null;

    if (parsed.mode === 'clarify') {
      return { mode: 'clarify', reply: String(parsed.reply), picks: [] };
    }

    const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : [];
    if (recs.length === 0) {
      // Claimed "recommend" but gave nothing to show -- not worth
      // rendering as a real recommendation, fall through to heuristic.
      return null;
    }
    return {
      mode: 'recommend',
      reply: String(parsed.reply),
      picks: recs.map((r: any) => ({
        type: String(r.type || 'strain'),
        slug: String(r.slug),
        reason: String(r.reason || ''),
      })),
    };
  } catch (e) {
    console.error('Failed to parse Claude response', e, text);
    return null;
  }
}

function resolvePick(
  pick: RawPick,
  strains: Strain[],
  concentrates: Concentrate[],
  edibles: Edible[]
): ResolvedPick | null {
  if (pick.type === 'concentrate') {
    const c = concentrates.find((x) => x.slug === pick.slug);
    if (!c) return null;
    return {
      type: 'concentrate',
      id: c.id,
      slug: c.slug,
      name: c.name,
      subtitle: [c.category, c.typical_thc_range].filter(Boolean).join(' · '),
      reason: pick.reason,
      href: `/concentrates/${c.slug}`,
    };
  }
  if (pick.type === 'edible') {
    const e = edibles.find((x) => x.slug === pick.slug);
    if (!e) return null;
    return {
      type: 'edible',
      id: e.id,
      slug: e.slug,
      name: e.name,
      subtitle: [e.category, e.dosage_mg != null ? `${e.dosage_mg}mg THC` : null].filter(Boolean).join(' · '),
      reason: pick.reason,
      href: `/edibles/${e.slug}`,
    };
  }
  const s = strains.find((x) => x.slug === pick.slug);
  if (!s) return null;
  return {
    type: 'strain',
    id: s.id,
    slug: s.slug,
    name: s.name,
    subtitle: `${s.type} · THC ${s.thc}% · CBD ${s.cbd}%`,
    reason: pick.reason,
    href: `/strains/${s.slug}`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const message: string = (body?.message || '').toString().slice(0, 1000);
    const history: ChatTurn[] = Array.isArray(body?.history) ? body.history : [];

    if (!message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const supabase = createServerReadClient();
    const [{ data: strainRows, error: strainErr }, { data: concentrateRows }, { data: edibleRows }] =
      await Promise.all([
        supabase.from('strains').select('*'),
        supabase.from('concentrates').select('*'),
        supabase.from('edibles').select('*'),
      ]);
    if (strainErr) throw strainErr;
    const strains = (strainRows || []).map(mapRow);
    const concentrates = (concentrateRows || []) as Concentrate[];
    const edibles = (edibleRows || []) as Edible[];

    // Personalized recommendations are a Canopy+ perk (see /pricing) -- a
    // signed-in free user still gets a great answer, just not one that
    // references their own rating history.
    const user = await getUserFromRequest(req);
    let historyDigest: string | null = null;
    let dislikedStrainIds = new Set<string>();
    if (user) {
      const admin = createAdminClient();
      const { data: profile } = admin
        ? await admin.from('profiles').select('member_tier').eq('id', user.id).maybeSingle()
        : { data: null };
      const isPlus = (profile as any)?.member_tier === 'plus';
      if (isPlus) {
        const { data: pastReviews } = await supabase
          .from('reviews')
          .select('rating, strains(id, name)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false })
          .limit(15);
        const rows = (pastReviews || []) as any[];
        if (rows.length > 0) {
          historyDigest = rows
            .filter((r) => r.strains)
            .map((r) => `${r.strains.name} ${r.rating}★`)
            .join(', ');
          dislikedStrainIds = new Set(rows.filter((r) => r.strains && r.rating <= 2).map((r) => r.strains.id));
        }
      }
    }

    let mode: 'clarify' | 'recommend' = 'recommend';
    let reply = '';
    let poweredBy: 'ai' | 'heuristic' = 'heuristic';
    let resolvedPicks: ResolvedPick[] = [];

    const aiResult = await callClaude(message, history, strains, concentrates, edibles, historyDigest);
    if (aiResult) {
      poweredBy = 'ai';
      mode = aiResult.mode;
      reply = aiResult.reply;
      if (mode === 'recommend') {
        resolvedPicks = aiResult.picks
          .map((p) => resolvePick(p, strains, concentrates, edibles))
          .filter((p): p is ResolvedPick => p !== null);
        if (resolvedPicks.length === 0) {
          // AI said "recommend" but every pick failed to resolve against
          // the real catalogs (bad slug, etc) -- fall back rather than
          // show an empty result.
          mode = 'recommend';
          poweredBy = 'heuristic';
          const pool = dislikedStrainIds.size > 0 ? strains.filter((s) => !dislikedStrainIds.has(s.id)) : strains;
          const picked = heuristicRecommend(message, pool.length >= 4 ? pool : strains);
          reply = heuristicReply(message, picked);
          resolvedPicks = picked.map((s) => ({
            type: 'strain',
            id: s.id,
            slug: s.slug,
            name: s.name,
            subtitle: `${s.type} · THC ${s.thc}% · CBD ${s.cbd}%`,
            reason: reasonForMatch(s, message),
            href: `/strains/${s.slug}`,
          }));
        }
      }
    } else {
      // No Claude API key, or the call failed -- the heuristic fallback
      // doesn't do the clarify step (it's not conversational), it just
      // gives its best strain-only match immediately.
      mode = 'recommend';
      const pool = dislikedStrainIds.size > 0 ? strains.filter((s) => !dislikedStrainIds.has(s.id)) : strains;
      const picked = heuristicRecommend(message, pool.length >= 4 ? pool : strains);
      reply = heuristicReply(message, picked);
      resolvedPicks = picked.map((s) => ({
        type: 'strain',
        id: s.id,
        slug: s.slug,
        name: s.name,
        subtitle: `${s.type} · THC ${s.thc}% · CBD ${s.cbd}%`,
        reason: reasonForMatch(s, message),
        href: `/strains/${s.slug}`,
      }));
    }

    // Look up which approved, in-stock dispensaries carry each pick --
    // scoped to the shopper's confirmed state (see lib/shopperState.ts).
    // Cannabis can't cross state lines, so "where to get this" must always
    // be limited to where the shopper actually is. Also newly enforcing
    // in_stock=true here, which the old flower-only version of this query
    // never did -- no point pointing someone at something they can't
    // actually buy right now.
    const shopperState = await getShopperState();
    const availability: Record<string, AvailabilityItem[]> = {};

    async function fillAvailability(column: 'strain_id' | 'concentrate_id' | 'edible_id', idToSlug: Map<string, string>) {
      const ids = Array.from(idToSlug.keys());
      if (ids.length === 0) return;
      let q = supabase
        .from('products')
        .select(`${column}, price, dispensaries!inner(name, slug, city, state, status)`)
        .in(column, ids)
        .eq('in_stock', true)
        .eq('dispensaries.status', 'approved');
      if (column === 'strain_id') q = q.eq('category', 'flower');
      if (shopperState) q = q.eq('dispensaries.state', shopperState);
      const { data } = await q;
      for (const row of data || []) {
        const disp: any = (row as any).dispensaries;
        const id = (row as any)[column];
        const slug = idToSlug.get(id);
        if (!slug || !disp) continue;
        if (!availability[slug]) availability[slug] = [];
        availability[slug].push({
          name: disp.name,
          slug: disp.slug,
          price: (row as any).price,
          city: disp.city,
          state: disp.state,
        });
      }
    }

    if (mode === 'recommend' && resolvedPicks.length > 0) {
      await Promise.all([
        fillAvailability('strain_id', new Map(resolvedPicks.filter((p) => p.type === 'strain').map((p) => [p.id, p.slug]))),
        fillAvailability(
          'concentrate_id',
          new Map(resolvedPicks.filter((p) => p.type === 'concentrate').map((p) => [p.id, p.slug]))
        ),
        fillAvailability('edible_id', new Map(resolvedPicks.filter((p) => p.type === 'edible').map((p) => [p.id, p.slug]))),
      ]);
    }

    // Log the query for the Industry Insights page. Awaited (not
    // fire-and-forget) since serverless functions don't guarantee work
    // continues after the response is sent -- but failures here should
    // never break the user-facing response.
    try {
      await supabase
        .from('search_logs')
        .insert({ query: message, matched_slugs: resolvedPicks.map((p) => p.slug) });
    } catch (logErr) {
      console.error('search log insert failed', logErr);
    }

    return NextResponse.json({
      mode,
      reply,
      poweredBy,
      personalized: !!historyDigest,
      picks: resolvedPicks.map((p) => ({
        type: p.type,
        slug: p.slug,
        name: p.name,
        subtitle: p.subtitle,
        reason: p.reason,
        href: p.href,
        availability: availability[p.slug] || [],
      })),
    });
  } catch (err: any) {
    console.error('assistant route error', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
