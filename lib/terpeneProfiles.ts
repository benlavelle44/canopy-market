// A small "budtender knowledge base" -- general, widely-cited educational
// associations between common cannabis terpenes and the effects/symptoms
// vocabulary used elsewhere in the app (see the closed lists in
// app/api/strains/research/route.ts). This powers the color-coded "Vibe &
// Chemistry" panel on strain pages: instead of three disconnected lists
// (Effects / May help with / Terpenes), a shopper can see *why* -- e.g.
// Limonene (amber) is visually tied to the Happy/Uplifted chips and the
// Stress/Anxiety chips it's associated with.
//
// These are general educational associations, not lab claims about any
// specific strain or batch -- always pair this with the standard AI/estimate
// disclaimer where the surrounding strain is a community find.

export interface TerpeneProfile {
  color: string; // hex
  vibe: string; // one-line flavor + character note
  effects: string[]; // subset of the app's closed Effects vocabulary
  symptoms: string[]; // subset of the app's closed Symptoms vocabulary
}

export const TERPENE_PROFILES: Record<string, TerpeneProfile> = {
  myrcene: {
    color: '#818CF8',
    vibe: 'Earthy, musky -- the classic sedating terpene.',
    effects: ['Relaxed', 'Sleepy'],
    symptoms: ['Insomnia', 'Pain', 'Muscle Spasms', 'Inflammation'],
  },
  limonene: {
    color: '#FBBF24',
    vibe: 'Bright citrus -- the mood-lifter.',
    effects: ['Happy', 'Uplifted', 'Euphoric'],
    symptoms: ['Stress', 'Anxiety', 'Depression'],
  },
  caryophyllene: {
    color: '#FB7185',
    vibe: 'Peppery, spicy -- the only terpene known to act directly on the body’s cannabinoid receptors.',
    effects: ['Relaxed'],
    symptoms: ['Pain', 'Inflammation', 'Anxiety', 'Stress'],
  },
  pinene: {
    color: '#34D399',
    vibe: 'Pine-fresh -- the alert, clear-headed one.',
    effects: ['Focused', 'Energetic', 'Clear-headed'],
    symptoms: ['Fatigue', 'Headaches'],
  },
  linalool: {
    color: '#C084FC',
    vibe: 'Floral lavender -- the calming one.',
    effects: ['Relaxed', 'Sleepy'],
    symptoms: ['Anxiety', 'Insomnia', 'Stress', 'Seizures'],
  },
  terpinolene: {
    color: '#22D3EE',
    vibe: 'Herbal, piney-citrus -- uplifting and creative.',
    effects: ['Uplifted', 'Creative', 'Energetic'],
    symptoms: ['Stress'],
  },
  humulene: {
    color: '#D97706',
    vibe: 'Woody, hoppy -- appetite-suppressing.',
    effects: ['Focused'],
    symptoms: ['Inflammation', 'Pain', 'Lack of Appetite'],
  },
  ocimene: {
    color: '#F472B6',
    vibe: 'Sweet, herbal -- bright and uplifting.',
    effects: ['Uplifted', 'Energetic'],
    symptoms: ['Inflammation'],
  },
  bisabolol: {
    color: '#7DD3FC',
    vibe: 'Chamomile-like -- soothing.',
    effects: ['Relaxed'],
    symptoms: ['Anxiety', 'Inflammation', 'Pain'],
  },
  valencene: {
    color: '#FB923C',
    vibe: 'Citrus, sweet -- energizing.',
    effects: ['Energetic', 'Uplifted'],
    symptoms: [],
  },
  geraniol: {
    color: '#E879F9',
    vibe: 'Floral, rose-like -- calming.',
    effects: ['Relaxed'],
    symptoms: ['Anxiety', 'Pain'],
  },
  nerolidol: {
    color: '#A78BFA',
    vibe: 'Woody, floral -- sedative.',
    effects: ['Sleepy', 'Relaxed'],
    symptoms: ['Insomnia', 'Fatigue'],
  },
  camphene: {
    color: '#A3E635',
    vibe: 'Earthy, damp -- soothing.',
    effects: ['Relaxed'],
    symptoms: ['Pain', 'Inflammation'],
  },
  eucalyptol: {
    color: '#2DD4BF',
    vibe: 'Minty, cool -- sharpens focus.',
    effects: ['Focused', 'Energetic'],
    symptoms: ['Fatigue', 'Inflammation'],
  },
  guaiol: {
    color: '#A8A29E',
    vibe: 'Woody, rose-like.',
    effects: [],
    symptoms: ['Inflammation', 'Pain'],
  },
  farnesene: {
    color: '#84CC16',
    vibe: 'Green apple -- mellow.',
    effects: ['Relaxed'],
    symptoms: ['Stress'],
  },
  sabinene: {
    color: '#EA580C',
    vibe: 'Spicy, woody.',
    effects: [],
    symptoms: ['Inflammation'],
  },
  fenchol: {
    color: '#4ADE80',
    vibe: 'Herbal, basil-like -- antioxidant.',
    effects: [],
    symptoms: ['Anxiety', 'Stress'],
  },
};

export const DEFAULT_TERPENE_COLOR = '#9CA3AF';

function key(name: string) {
  return name.trim().toLowerCase();
}

export function getTerpeneProfile(name: string): TerpeneProfile | undefined {
  return TERPENE_PROFILES[key(name)];
}

export function getTerpeneColor(name: string): string {
  return TERPENE_PROFILES[key(name)]?.color || DEFAULT_TERPENE_COLOR;
}

export function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  const bigint = parseInt(full, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Finds the dominant terpene (by percentage) present on a strain whose
// profile claims a given effect or symptom label -- used to color-link a
// chip back to "what's causing this."
export function linkedTerpeneFor(
  label: string,
  terpenes: { name: string; percentage: number }[]
): (TerpeneProfile & { name: string; percentage: number }) | undefined {
  const sorted = [...terpenes].sort((a, b) => b.percentage - a.percentage);
  for (const t of sorted) {
    const profile = getTerpeneProfile(t.name);
    if (profile && (profile.effects.includes(label) || profile.symptoms.includes(label))) {
      return { ...profile, name: t.name, percentage: t.percentage };
    }
  }
  return undefined;
}
