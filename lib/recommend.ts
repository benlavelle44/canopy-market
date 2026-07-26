import { Strain } from './types';

// Lightweight keyword -> symptom/effect matcher used whenever the AI
// assistant runs without an ANTHROPIC_API_KEY configured. It's not an LLM,
// but it grounds itself entirely in the real strain database so results
// are always accurate to what's actually in the catalog.

const SYMPTOM_ALIASES: Record<string, string[]> = {
  Stress: ['stress', 'stressed', 'overwhelmed', 'wound up'],
  Pain: ['pain', 'ache', 'aching', 'sore', 'hurts', 'hurting'],
  Depression: ['depress', 'sad', 'down', 'low mood'],
  Anxiety: ['anxiety', 'anxious', 'panic', 'nervous', 'on edge'],
  Insomnia: ['insomnia', "can't sleep", 'cant sleep', 'sleep', 'sleepless'],
  Fatigue: ['fatigue', 'tired', 'exhausted', 'low energy', 'no energy'],
  Headaches: ['headache', 'head hurts'],
  Migraines: ['migraine'],
  Nausea: ['nausea', 'nauseous', 'sick to my stomach'],
  'Lack of Appetite': ['appetite', "won't eat", 'not hungry', 'no appetite'],
  'Muscle Spasms': ['muscle spasm', 'cramp', 'spasm'],
  Inflammation: ['inflammation', 'inflamed', 'swelling'],
  PTSD: ['ptsd', 'trauma'],
  Seizures: ['seizure', 'epilep'],
};

const EFFECT_ALIASES: Record<string, string[]> = {
  Relaxed: ['relax', 'chill', 'calm', 'unwind', 'mellow'],
  Happy: ['happy', 'happier', 'good mood', 'cheer'],
  Euphoric: ['euphoria', 'euphoric', 'high high', 'blissful'],
  Creative: ['creative', 'creativity', 'inspired'],
  Uplifted: ['uplift', 'lifted', 'boost'],
  Energetic: ['energetic', 'energy', 'active', 'productive'],
  Focused: ['focus', 'concentrate', 'clear headed', 'clear-headed'],
  Sleepy: ['sleepy', 'drowsy', 'nighttime', 'night time', 'bedtime'],
  Hungry: ['hungry', 'munchies', 'appetite boost'],
  Giggly: ['giggly', 'laugh', 'social', 'party'],
  'Clear-headed': ['clear headed', 'clear-headed', 'functional', 'daytime'],
};

function scoreStrain(strain: Strain, message: string): number {
  const text = message.toLowerCase();
  let score = 0;
  for (const symptom of strain.symptoms) {
    const aliases = SYMPTOM_ALIASES[symptom] || [symptom.toLowerCase()];
    if (aliases.some((a) => text.includes(a))) score += 3;
  }
  for (const effect of strain.effects) {
    const aliases = EFFECT_ALIASES[effect] || [effect.toLowerCase()];
    if (aliases.some((a) => text.includes(a))) score += 2;
  }
  if (/\bindica\b/.test(text) && strain.type === 'Indica') score += 4;
  if (/\bsativa\b/.test(text) && strain.type === 'Sativa') score += 4;
  if (/\bhybrid\b/.test(text) && strain.type === 'Hybrid') score += 4;
  if (/\bcbd\b|no high|not high|without.*high|non.?intoxicating/.test(text) && strain.cbd >= 5) score += 5;
  if (/\bmild\b|low thc|beginner|new to/.test(text) && strain.thc <= 15) score += 2;
  if (/\bstrong\b|potent|high thc|experienced/.test(text) && strain.thc >= 22) score += 2;
  score += strain.rating * 0.3;
  return score;
}

export function heuristicRecommend(message: string, strains: Strain[], limit = 4): Strain[] {
  const scored = strains
    .map((s) => ({ s, score: scoreStrain(s, message) }))
    .sort((a, b) => b.score - a.score);

  const top = scored.filter((x) => x.score > 0).slice(0, limit);
  if (top.length === 0) {
    return [...strains].sort((a, b) => b.rating - a.rating).slice(0, limit);
  }
  return top.map((x) => x.s);
}

// A short, skimmable "why this one" line per tile -- the assistant used to
// just dump spec-sheet cards with no explanation attached to any single
// result. Built from whichever aliases in the user's own message actually
// matched this specific strain, so it reads as a real reason rather than
// boilerplate.
export function reasonForMatch(strain: Strain, message: string): string {
  const text = message.toLowerCase();
  const matchedEffects = strain.effects.filter((e) =>
    (EFFECT_ALIASES[e] || [e.toLowerCase()]).some((a) => text.includes(a))
  );
  const matchedSymptoms = strain.symptoms.filter((s) =>
    (SYMPTOM_ALIASES[s] || [s.toLowerCase()]).some((a) => text.includes(a))
  );

  const bits: string[] = [];
  if (matchedEffects.length > 0) bits.push(matchedEffects.slice(0, 2).join(' + '));
  if (matchedSymptoms.length > 0) bits.push(`eases ${matchedSymptoms.slice(0, 2).join(', ').toLowerCase()}`);
  if (/\bindica\b/.test(text) && strain.type === 'Indica') bits.push('Indica, as asked');
  if (/\bsativa\b/.test(text) && strain.type === 'Sativa') bits.push('Sativa, as asked');
  if (/\bhybrid\b/.test(text) && strain.type === 'Hybrid') bits.push('Hybrid, as asked');
  if (/\bcbd\b|non.?intoxicating/.test(text) && strain.cbd >= 5) bits.push(`CBD ${strain.cbd}%`);
  if (/\bstrong\b|potent|high thc/.test(text) && strain.thc >= 22) bits.push(`potent, THC ${strain.thc}%`);
  if (/\bmild\b|low thc|beginner/.test(text) && strain.thc <= 15) bits.push('gentler, lower THC');

  if (bits.length === 0) return `Highly rated ${strain.type.toLowerCase()} overall`;
  return bits.slice(0, 2).join(' · ');
}

// Terpene-profile similarity -- used on strain detail pages to surface
// strains with a similar "feel" by chemistry rather than just a shared
// Indica/Sativa/Hybrid label, including strains from anywhere in the
// catalog a shopper (or dispensary) might never have searched for by name.
function terpeneVector(strain: Strain): Record<string, number> {
  const v: Record<string, number> = {};
  for (const t of strain.terpenes || []) {
    v[t.name] = (v[t.name] || 0) + (Number(t.percentage) || 0);
  }
  return v;
}

function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0;
  let magA = 0;
  let magB = 0;
  for (const k of keys) {
    const av = a[k] || 0;
    const bv = b[k] || 0;
    dot += av * bv;
    magA += av * av;
    magB += bv * bv;
  }
  if (magA === 0 || magB === 0) return 0;
  return dot / (Math.sqrt(magA) * Math.sqrt(magB));
}

export interface TerpeneSimilarResult {
  strain: Strain;
  similarity: number; // 0-1, cosine similarity of terpene profiles
  sharedTerpenes: string[]; // dominant terpenes present in both profiles
}

/**
 * Ranks `candidates` by how closely their terpene profile matches `strain`'s,
 * regardless of Indica/Sativa/Hybrid type -- so a hybrid leaning heavy on
 * myrcene can surface a myrcene-dominant indica or sativa a shopper (or a
 * dispensary sourcing new inventory) might otherwise never have found.
 */
export function terpeneSimilarStrains(
  strain: Strain,
  candidates: Strain[],
  limit = 4
): TerpeneSimilarResult[] {
  const target = terpeneVector(strain);
  const targetTop = new Set(
    Object.entries(target)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([name]) => name)
  );

  const scored = candidates
    .filter((c) => c.id !== strain.id)
    .map((c) => {
      const vec = terpeneVector(c);
      const similarity = cosineSimilarity(target, vec);
      const sharedTerpenes = Object.keys(vec).filter((name) => targetTop.has(name));
      return { strain: c, similarity, sharedTerpenes };
    })
    .filter((x) => x.similarity > 0)
    .sort((a, b) => b.similarity - a.similarity || b.strain.rating - a.strain.rating)
    .slice(0, limit);

  return scored;
}

export function heuristicReply(message: string, picks: Strain[]): string {
  if (picks.length === 0) {
    return "I couldn't find a great match for that -- try describing how you want to feel, or a symptom you're dealing with (e.g. \"something to help me sleep\" or \"low-key energy for daytime\").";
  }
  const names = picks.map((p) => p.name).join(', ');
  const first = picks[0];
  return `Based on what you described, ${first.name} (${first.type}, ${first.thc}% THC) is a strong match -- it's known for ${first.effects
    .slice(0, 3)
    .join(', ')
    .toLowerCase()}. I'd also look at ${picks
    .slice(1)
    .map((p) => p.name)
    .join(', ') || 'similar options'}. Check the cards below for dispensaries near you carrying these.`;
}
