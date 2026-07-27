import { Strain } from '@/lib/types';
import { getTerpeneProfile, getTerpeneColor, hexToRgba } from '@/lib/terpeneProfiles';

// Replaces the old three-separate-lists layout (Effects / May help with /
// Terpenes) with one color-coded panel that connects them: each dominant
// terpene gets a color, and the effect/symptom chips it's associated with
// pick up that same color -- so instead of just listing "Relaxed, Stress,
// Limonene" a shopper can actually see the thread: Limonene (amber) -> Happy,
// Uplifted -> eases Stress, Anxiety. This is the "AI budtender" layer that
// turns a spec sheet into an explanation.

export default function VibeChemistry({ strain }: { strain: Strain }) {
  const sorted = [...strain.terpenes].sort((a, b) => b.percentage - a.percentage);
  const claimed = new Set<string>();

  const groups = sorted.map((t) => {
    const profile = getTerpeneProfile(t.name);
    const color = getTerpeneColor(t.name);
    const matchedEffects = profile ? strain.effects.filter((e) => profile.effects.includes(e)) : [];
    const matchedSymptoms = profile ? strain.symptoms.filter((s) => profile.symptoms.includes(s)) : [];
    matchedEffects.forEach((e) => claimed.add(e));
    matchedSymptoms.forEach((s) => claimed.add(s));
    return { terpene: t, profile, color, matchedEffects, matchedSymptoms };
  });

  const leftoverEffects = strain.effects.filter((e) => !claimed.has(e));
  const leftoverSymptoms = strain.symptoms.filter((s) => !claimed.has(s));

  return (
    <div className="rounded-2xl border border-canopy-border bg-canopy-card p-4">
      <div className="mb-1 flex items-center gap-2">
        <span className="text-lg">🔮</span>
        <h3 className="text-sm font-semibold text-canopy-text">Vibe &amp; Chemistry</h3>
      </div>
      <p className="mb-2 text-[11px] text-canopy-muted">
        Color-linked by dominant terpene -- see what's believed to drive each effect.
      </p>

      {/* Explicit, educational color key. Each terpene keeps ONE fixed color
          everywhere in the app (see lib/terpeneProfiles.ts) -- that part is
          already consistent. What isn't obvious without a key: the same
          effect word (e.g. "Relaxed") can show up in more than one color
          below, because more than one terpene can independently cause it --
          each chip is colored by the terpene that causes it, not by the
          effect itself. Spelling that out here, with the one-line "what it
          is" for each terpene, means nobody has to decode it by hue alone or
          just take the color's word for it. */}
      <div className="mb-3 rounded-lg bg-canopy-bg/60 px-2.5 py-2">
        <p className="mb-1.5 text-[10px] uppercase tracking-wide text-canopy-muted">
          Key -- same color below = same terpene. One effect can have several colors if more than one terpene causes it.
        </p>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {groups.map((g) => (
            <span key={g.terpene.name} className="flex items-center gap-1.5 text-[10px] text-canopy-muted">
              <span className="inline-block h-2 w-2 flex-shrink-0 rounded-full" style={{ backgroundColor: g.color }} />
              <span className="font-medium" style={{ color: g.color }}>{g.terpene.name}</span>
              {g.profile && <span>-- {g.profile.vibe}</span>}
            </span>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {groups.map((g) => (
          <div
            key={g.terpene.name}
            className="rounded-xl border-l-4 py-1.5 pl-3"
            style={{ borderLeftColor: g.color, backgroundColor: hexToRgba(g.color, 0.06) }}
          >
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="inline-block h-2 w-2 rounded-full" style={{ backgroundColor: g.color }} />
              <span className="text-xs font-semibold" style={{ color: g.color }}>
                {g.terpene.name}
              </span>
              <span className="text-[11px] text-canopy-muted">{(g.terpene.percentage * 100).toFixed(0)}%</span>
            </div>
            {g.profile && <p className="mt-0.5 text-[11px] italic text-canopy-muted">{g.profile.vibe}</p>}

            {g.matchedEffects.length > 0 && (
              <div className="mt-1.5 flex flex-wrap items-center gap-1">
                <span className="text-[10px] uppercase tracking-wide text-canopy-muted">Feels like</span>
                {g.matchedEffects.map((e) => (
                  <span
                    key={e}
                    className="rounded-full px-2 py-0.5 text-[11px] font-medium"
                    style={{ backgroundColor: hexToRgba(g.color, 0.16), color: g.color }}
                  >
                    {e}
                  </span>
                ))}
              </div>
            )}
            {g.matchedSymptoms.length > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-1">
                <span className="text-[10px] uppercase tracking-wide text-canopy-muted">May help with</span>
                {g.matchedSymptoms.map((s) => (
                  <span
                    key={s}
                    className="rounded-full border px-2 py-0.5 text-[11px]"
                    style={{ borderColor: hexToRgba(g.color, 0.5), color: g.color }}
                  >
                    {s}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {(leftoverEffects.length > 0 || leftoverSymptoms.length > 0) && (
        <div className="mt-3 border-t border-canopy-border pt-2.5">
          <p className="mb-1.5 text-[10px] uppercase tracking-wide text-canopy-muted">Also reported</p>
          <div className="flex flex-wrap gap-1">
            {leftoverEffects.map((e) => (
              <span key={e} className="rounded-full bg-canopy-bg px-2 py-0.5 text-[11px] text-canopy-text">
                {e}
              </span>
            ))}
            {leftoverSymptoms.map((s) => (
              <span key={s} className="rounded-full bg-canopy-bg px-2 py-0.5 text-[11px] text-canopy-muted">
                {s}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
