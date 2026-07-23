// Standard legal/trust disclaimer for any AI-researched content across the
// app -- currently the AI Strain Finder, but written generically so future
// features (e.g. AI-assisted dispensary descriptions) can reuse the exact
// same wording instead of drifting into slightly different copy every time.
// Keep this the single source of truth for this disclaimer's language.
//
// Kept intentionally short -- this renders at the bottom of strain pages
// pointed to by "*" markers on the estimated fields above it, so it reads
// as a footnote, not a wall of legal text.

export interface DisclaimerSource {
  url: string;
  title: string;
}

function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url;
  }
}

export default function AiEstimateDisclaimer({
  sources,
  compact = false,
  id,
}: {
  sources?: DisclaimerSource[];
  compact?: boolean;
  id?: string;
}) {
  const shown = (sources || []).slice(0, 2);
  const extra = (sources?.length || 0) - shown.length;

  return (
    <div
      id={id}
      className={`scroll-mt-24 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-200 ${
        compact ? 'px-3 py-2 text-[11px]' : 'px-4 py-2.5 text-xs'
      }`}
    >
      <p>
        <span className="font-semibold">*AI-researched estimate.</span> Compiled from public sources, not
        lab-verified. THC/CBD, effects, and terpenes vary by batch. Not medical advice.
      </p>
      {shown.length > 0 && (
        <p className="mt-1 text-[10px] opacity-75">
          Sources:{' '}
          {shown.map((s, i) => (
            <span key={s.url}>
              <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline hover:text-yellow-100">
                {hostname(s.url)}
              </a>
              {i < shown.length - 1 ? ', ' : ''}
            </span>
          ))}
          {extra > 0 ? ` +${extra} more` : ''}
        </p>
      )}
    </div>
  );
}
