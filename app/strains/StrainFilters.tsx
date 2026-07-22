'use client';

import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { useState } from 'react';

const TYPES = ['Indica', 'Sativa', 'Hybrid'];
const SYMPTOMS = ['Stress', 'Pain', 'Anxiety', 'Insomnia', 'Depression', 'Fatigue', 'Headaches'];

export default function StrainFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [q, setQ] = useState(searchParams.get('q') || '');

  const updateParam = (key: string, value: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    router.push(`${pathname}?${params.toString()}`);
  };

  const activeType = searchParams.get('type');
  const activeSymptom = searchParams.get('symptom');

  return (
    <div className="mb-8 space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault();
          updateParam('q', q || null);
        }}
      >
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search strains by name…"
          className="w-full rounded-full border border-canopy-border bg-canopy-panel px-5 py-3 text-sm focus:border-canopy-green focus:outline-none"
        />
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-canopy-muted">Type</span>
        {TYPES.map((t) => (
          <button
            key={t}
            onClick={() => updateParam('type', activeType === t ? null : t)}
            className={`rounded-full border px-3 py-1 text-xs ${
              activeType === t
                ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                : 'border-canopy-border text-canopy-muted hover:text-canopy-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs uppercase tracking-wide text-canopy-muted">Helps with</span>
        {SYMPTOMS.map((s) => (
          <button
            key={s}
            onClick={() => updateParam('symptom', activeSymptom === s ? null : s)}
            className={`rounded-full border px-3 py-1 text-xs ${
              activeSymptom === s
                ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                : 'border-canopy-border text-canopy-muted hover:text-canopy-text'
            }`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );
}
