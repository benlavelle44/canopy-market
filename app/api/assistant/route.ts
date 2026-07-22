import { NextRequest, NextResponse } from 'next/server';
import { createServerReadClient } from '@/lib/supabaseServer';
import { heuristicRecommend, heuristicReply } from '@/lib/recommend';
import { Strain } from '@/lib/types';

export const runtime = 'nodejs';

interface ChatTurn {
  role: 'user' | 'assistant';
  content: string;
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

async function callClaude(message: string, history: ChatTurn[], strains: Strain[]) {
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

  const system = `You are the AI budtender for Canopy Market, a cannabis strain discovery marketplace. You help people find strains for how they want to feel or symptoms they want relief from. You are NOT a doctor and must never give medical advice or dosing instructions -- keep guidance general and always suggest starting low and going slow, and suggest consulting a doctor for medical conditions.

Only recommend strains from this exact catalog (never invent strains):
${catalog}

Respond ONLY with valid JSON, no markdown fences, matching this shape:
{"reply": "a warm, concise 2-4 sentence response", "recommended_slugs": ["slug1","slug2","slug3"]}

Pick 2-4 of the most relevant strains by slug from the catalog above.`;

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
      max_tokens: 500,
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
    return {
      reply: String(parsed.reply || ''),
      slugs: Array.isArray(parsed.recommended_slugs) ? parsed.recommended_slugs.slice(0, 4) : [],
    };
  } catch (e) {
    console.error('Failed to parse Claude response', e, text);
    return { reply: text.slice(0, 600), slugs: [] };
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

    let reply = '';
    let picked: Strain[] = [];
    let poweredBy: 'ai' | 'heuristic' = 'heuristic';

    const aiResult = await callClaude(message, history, strains);
    if (aiResult) {
      poweredBy = 'ai';
      reply = aiResult.reply;
      picked = aiResult.slugs
        .map((slug: string) => strains.find((s) => s.slug === slug))
        .filter(Boolean) as Strain[];
      if (picked.length === 0) picked = heuristicRecommend(message, strains);
    } else {
      picked = heuristicRecommend(message, strains);
      reply = heuristicReply(message, picked);
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
    });
  } catch (err: any) {
    console.error('assistant route error', err);
    return NextResponse.json(
      { error: 'Something went wrong. Please try again.' },
      { status: 500 }
    );
  }
}
