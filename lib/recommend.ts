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
