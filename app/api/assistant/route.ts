import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createServerReadClient } from '@/lib/supabaseServer';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { heuristicRecommend, heuristicReply, reasonForMatch } from '@/lib/recommend';
import { Strain } from '@/lib/types';

export const runtime = 'nodejs';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
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

async function callClaude(
  message: string,
  history: ChatTurn[],
  strains: Strain[],
  historyDigest: string | null
) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return null;

  const catalog = strains
    .map(
      (s) =>
        `${s.slug} | ${s.name} | ${s.type} | THC ${s.thc}% CBD ${s.cbd}% | effects: ${s.effects.join(
          ', '
        )} | helps with: ${s.symptoms.join(', ')}`
    )
    .join('\n');

  const personalization = historyDigest
    ? `\nThis shopper's past ratings on Canopy: ${historyDigest}. Lean toward strains similar in effects/type to ones they rated 4-5 stars. Avoid recommending something they rated 2 stars or below unless nothing else fits -- and if you do include or skip one for this reason, say so briefly in its "reason".`
    : '';

  const system = `You are the AI budtender for Canopy Market, a cannabis strain discovery marketplace. You help people find strains for how they want to feel or symptoms they want relief from. You are NOT a doctor and must never give medical advice or dosing instructions -- keep guidance general and always suggest starting low and going slow, and suggest consulting a doctor for medical conditions.

Only recommend strains from this exact catalog (never invent strains):
${catalog}
${personalization}

Respond ONLY with valid JSON, no markdown fences, matching this shape:
{"reply": "a warm, concise 2-4 sentence response", "recommendations": [{"slug": "slug1", "reason": "under 10 words, specific to this strain and this request"}, {"slug": "slug2", "reason": "..."}]}

Pick 2-4 of the most relevant strains by slug from the catalog above. Every recommendation needs its own short, specific reason -- never leave it generic or blank.`;

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
  const text = data?.content?.[0]?.text || '';
  try {
    const cleaned = text.trim().replace(/^```json\s*/i, '').replace(/```\s*$/, '');
    const parsed = JSON.parse(cleaned);
    const recs = Array.isArray(parsed.recommendations) ? parsed.recommendations.slice(0, 4) : [];
    return {
      reply: String(parsed.reply || ''),
      slugs: recs.map((r: any) => String(r.slug)),
      reasons: Object.fromEntries(recs.map((r: any) => [String(r.slug), String(r.reason || '')])),
    };
  } catch (e) {
    console.error('Failed to parse Claude response', e, text);
    return { reply: text.slice(0, 600), slugs: [], reasons: {} };
  }
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
    const { data: strainRows, error } = await supabase.from('strains').select('*');
    if (error) throw error;
    const strains = (strainRows || []).map(mapRow);

    // Best-effort personalization: if this caller is signed in, pull their
    // own past strain ratings so results can lean toward what they've liked
    // and steer around what they've rated poorly, instead of treating every
    // request as a first-time stranger.
    const user = await getUserFromRequest(req);
    let historyDigest: string | null = null;
    let dislikedStrainIds = new Set<string>();
    if (user) {
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

    let reply = '';
    let picked: Strain[] = [];
    let poweredBy: 'ai' | 'heuristic' = 'heuristic';
    let reasons: Record<string, string> = {};

    const aiResult = await callClaude(message, history, strains, historyDigest);
    if (aiResult) {
      poweredBy = 'ai';
      reply = aiResult.reply;
      picked = aiResult.slugs
        .map((slug: string) => strains.find((s) => s.slug === slug))
        .filter(Boolean) as Strain[];
      reasons = aiResult.reasons || {};
      if (picked.length === 0) picked = heuristicRecommend(message, strains);
    } else {
      // Heuristic fallback also respects personalization -- skip strains
      // this person has already rated 2 stars or below when there's a
      // decent alternative pool to pick from instead.
      const pool = dislikedStrainIds.size > 0 ? strains.filter((s) => !dislikedStrainIds.has(s.id)) : strains;
      picked = heuristicRecommend(message, pool.length >= 4 ? pool : strains);
      reply = heuristicReply(message, picked);
    }

    if (Object.keys(reasons).length === 0) {
      reasons = Object.fromEntries(picked.map((s) => [s.slug, reasonForMatch(s, message)]));
    }

    // Look up which approved dispensaries carry these strains
    const strainIds = picked.map((p) => p.id);
    let availability: Record<string, { name: string; slug: string; price: number | null; city: string; state: string }[]> = {};

    if (strainIds.length > 0) {
      const { data: products } = await supabase
        .from('products')
        .select('strain_id, price, dispensaries!inner(id, name, slug, city, state, status)')
        .in('strain_id', strainIds)
        .eq('category', 'flower')
        .eq('dispensaries.status', 'approved');

      for (const row of products || []) {
        const disp: any = (row as any).dispensaries;
        const strain = picked.find((p) => p.id === (row as any).strain_id);
        if (!strain || !disp) continue;
        if (!availability[strain.slug]) availability[strain.slug] = [];
        availability[strain.slug].push({
          name: disp.name,
          slug: disp.slug,
          price: (row as any).price,
          city: disp.city,
          state: disp.state,
        });
      }
    }

    // Log the query for the Industry Insights page. Awaited (not
    // fire-and-forget) since serverless functions don't guarantee work
    // continues after the response is sent -- but failures here should
    // never break the user-facing response.
    try {
      await supabase
        .from('search_logs')
        .insert({ query: message, matched_slugs: picked.map((p) => p.slug) });
    } catch (logErr) {
      console.error('search log insert failed', logErr);
    }

    return NextResponse.json({
      reply,
      poweredBy,
      strains: picked,
      availability,
      reasons,
      personalized: !!historyDigest,
    });
  } catch (err: any) {
    console.error('assistant route error', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
