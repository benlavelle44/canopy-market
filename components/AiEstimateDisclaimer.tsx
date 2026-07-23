// Standard legal/trust disclaimer for any AI-researched content across the
// app -- currently the AI Strain Finder, but written generically so future
// features (e.g. AI-assisted dispensary descriptions) can reuse the exact
// same wording instead of drifting into slightly different copy every time.
// Keep this the single source of truth for this disclaimer's language.

export interface DisclaimerSource {
  url: string;
  title: string;
}

export default function AiEstimateDisclaimer({
  sources,
  compact = false,
}: {
  sources?: DisclaimerSource[];
  compact?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 ${
        compact ? 'px-3 py-2 text-xs' : 'px-4 py-3 text-sm'
      }`}
    >
      <p>
        <span className="font-semibold">AI-researched estimate.</span> This information was compiled by AI from
        public sources and has not been lab-verified or independently confirmed by Canopy Market. THC/CBD
        percentages, effects, and terpene content are estimates and can vary by grower, batch, and testing method.
        This is not medical advice -- talk to a doctor about any health condition.
      </p>
      {sources && sources.length > 0 && (
        <p className="mt-2 text-[11px] opacity-80">
          Sources:{' '}
          {sources.map((s, i) => (
            <span key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-100">
                {s.title}
              </a>
              {i < sources.length - 1 ? ', ' : ''}
            </span>
          ))}
        </p>
      )}
    </div>
  );
}
