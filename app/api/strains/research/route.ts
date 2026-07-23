import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createServerReadClient } from '@/lib/supabaseServer';
import { findSimilarNames, isLikelyTypo } from '@/lib/fuzzy';
import { StrainType } from '@/lib/types';

export const runtime = 'nodejs';

// AI Strain Finder, step 1: research. Signed-in-only (checked below), never
// writes to the database -- it just researches a strain name via Claude's
// web search tool and hands the candidate back to the browser so the person
// can confirm "yes, that's the one" before anything is saved (see
// /api/strains/confirm). This keeps a typo or a bad AI guess from ever
// reaching the catalog un-reviewed.

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

interface ResearchCandidate {
  name: string;
  type: StrainType;
  thc: number;
  cbd: number;
  description: string;
  effects: string[];
  symptoms: string[];
  terpenes: { name: string; percentage: number }[];
}

// Claude's final message, when web search is enabled, sometimes reasons in
// prose before landing on the JSON answer despite instructions to end with
// only JSON -- so rather than assume the whole text block IS the JSON, pull
// the JSON out of wherever it ended up: a fenced code block if present,
// otherwise the outermost {...} span, otherwise the whole trimmed text as a
// last resort.
function extractTrailingJson(text: string): any {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fenced) {
    try {
      return JSON.parse(fenced[1].trim());
    } catch {
      // fall through to brace matching
    }
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return JSON.parse(text.slice(firstBrace, lastBrace + 1));
    } catch {
      // fall through to raw parse, which will throw and be handled by the caller
    }
  }
  return JSON.parse(text.trim());
}

async function researchStrain(query: string): Promise<
  | { found: false; reason: string }
  | { found: true; candidate: ResearchCandidate; sources: { url: string; title: string }[] }
> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { found: false, reason: 'Strain lookup is not configured right now.' };

  const system = `You are a cannabis strain research assistant for Canopy Market. Given a strain name someone searched for that isn't in our catalog, use web search to determine whether it's a real, identifiable cannabis strain (grower/breeder pages, seed banks, Leafly/Weedmaps/AllBud-style strain databases, cultivar registries, etc. all count as valid sources).

Be skeptical: if you can't find genuine, consistent information from real sources, or the name is too generic/misspelled/ambiguous to confidently identify a specific strain, say so rather than guessing.

If you DO confidently identify it, respond with your best-estimate typical values (not ranges) -- these will be shown to the user labeled as AI estimates, not lab-verified numbers.

You may reason through the evidence first, but your message must END with exactly one JSON object matching one of these two shapes, and nothing after it -- no closing remarks, no sign-off:

Not found / not confident:
{"found": false, "reason": "one sentence explaining why (e.g. no reliable sources, likely a typo, too generic)"}

Found:
{"found": true, "candidate": {"name": "Proper Cased Strain Name", "type": "Indica|Sativa|Hybrid", "thc": 22, "cbd": 0.1, "description": "2-3 sentence description in our house style", "effects": ["Relaxed","Happy"], "symptoms": ["Stress","Pain"], "terpenes": [{"name":"Myrcene","percentage":0.3},{"name":"Caryophyllene","percentage":0.2}]}}

effects and symptoms should each have 2-4 items using these exact vocabularies when applicable -- effects: Relaxed, Happy, Euphoric, Creative, Uplifted, Energetic, Focused, Sleepy, Hungry, Giggly, Clear-headed; symptoms: Stress, Pain, Depression, Anxiety, Insomnia, Fatigue, Headaches, Migraines, Nausea, Lack of Appetite, Muscle Spasms, Inflammation, PTSD, Seizures. terpenes should list 2-3 dominant terpenes with percentage as a fraction (0.3 = 30%), highest first.`;

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || 'claude-sonnet-5',
      max_tokens: 1200,
      system,
      messages: [{ role: 'user', content: `Research this cannabis strain: "${query}"` }],
      tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 4 }],
    }),
  });

  if (!res.ok) {
    console.error('Anthropic research call failed', res.status, await res.text());
    return { found: false, reason: 'The lookup failed -- please try again in a moment.' };
  }

  const data = await res.json();

  if (data?.stop_reason === 'pause_turn') {
    return { found: false, reason: 'That search took too long to complete -- please try again.' };
  }

  const blocks: any[] = Array.isArray(data?.content) ? data.content : [];
  const textBlocks = blocks.filter((b) => b.type === 'text');
  const finalText = textBlocks.length ? textBlocks[textBlocks.length - 1].text : '';

  const sources: { url: string; title: string }[] = [];
  const seenUrls = new Set<string>();
  for (const b of blocks) {
    if (b.type === 'web_search_tool_result' && Array.isArray(b.content)) {
      for (const r of b.content) {
        if (r?.url && !seenUrls.has(r.url)) {
          seenUrls.add(r.url);
          sources.push({ url: r.url, title: r.title || r.url });
        }
      }
    }
  }

  try {
    const parsed = extractTrailingJson(finalText);
    if (!parsed.found) {
      return { found: false, reason: parsed.reason || "Couldn't confidently identify that strain." };
    }
    const c = parsed.candidate || {};
    if (!c.name || !c.type) {
      return { found: false, reason: "Couldn't confidently identify that strain." };
    }
    return {
      found: true,
      candidate: {
        name: String(c.name).slice(0, 120),
        type: ['Indica', 'Sativa', 'Hybrid'].includes(c.type) ? c.type : 'Hybrid',
        thc: Number(c.thc) || 0,
        cbd: Number(c.cbd) || 0,
        description: String(c.description || '').slice(0, 600),
        effects: Array.isArray(c.effects) ? c.effects.slice(0, 4).map(String) : [],
        symptoms: Array.isArray(c.symptoms) ? c.symptoms.slice(0, 4).map(String) : [],
        terpenes: Array.isArray(c.terpenes)
          ? c.terpenes.slice(0, 3).map((t: any) => ({ name: String(t.name), percentage: Number(t.percentage) || 0 }))
          : [],
      },
      sources: sources.slice(0, 5),
    };
  } catch (e) {
    console.error('Failed to parse strain research response', e, finalText);
    return { found: false, reason: "Couldn't parse the research results -- please try again." };
  }
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required to use the strain finder.' }, { status: 401 });

    const body = await req.json();
    const query: string = (body?.query || '').toString().trim().slice(0, 120);
    if (!query) return NextResponse.json({ error: 'A strain name is required.' }, { status: 400 });

    // Defense in depth: re-check for a near-duplicate name server-side even
    // though the /strains page already offered "did you mean" suggestions,
    // in case this was called directly.
    const supabase = createServerReadClient();
    const { data: allStrains } = await supabase.from('strains').select('slug, name').eq('verification_status', 'verified');
    const names = allStrains || [];

    if (isLikelyTypo(query, names, (n) => n.name)) {
      const match = findSimilarNames(query, names, (n) => n.name, { limit: 1 })[0];
      return NextResponse.json({ alreadyExists: true, match: match.item });
    }

    const result = await researchStrain(query);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error('strain research route error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
