import { createServerReadClient } from '@/lib/supabaseServer';

export const revalidate = 0;

async function getInsights() {
  const supabase = createServerReadClient();

  const [{ data: strains }, { data: dispensaries }, { data: searches }, { data: topRated }] =
    await Promise.all([
      supabase.from('strains').select('type'),
      supabase.from('dispensaries').select('state, status'),
      supabase.from('search_logs').select('query, created_at').order('created_at', { ascending: false }).limit(200),
      supabase.from('strains').select('name, rating, review_count').order('rating', { ascending: false }).limit(5),
    ]);

  const typeCounts: Record<string, number> = {};
  for (const s of strains || []) {
    typeCounts[s.type] = (typeCounts[s.type] || 0) + 1;
  }

  const stateCounts: Record<string, number> = {};
  for (const d of dispensaries || []) {
    if (d.status !== 'approved') continue;
    stateCounts[d.state] = (stateCounts[d.state] || 0) + 1;
  }

  const queryCounts: Record<string, number> = {};
  for (const row of searches || []) {
    const q = row.query.trim().toLowerCase();
    queryCounts[q] = (queryCounts[q] || 0) + 1;
  }
  const topQueries = Object.entries(queryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  return {
    typeCounts,
    stateCounts,
    topQueries,
    totalSearches: (searches || []).length,
    topRated: topRated || [],
  };
}

export default async function InsightsPage() {
  const { typeCounts, stateCounts, topQueries, totalSearches, topRated } = await getInsights();
  const maxState = Math.max(1, ...Object.values(stateCounts));
  const maxQuery = Math.max(1, ...topQueries.map(([, c]) => c));
  const totalStrains = Object.values(typeCounts).reduce((a, b) => a + b, 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <div className="mb-10 text-center">
        <h1 className="font-groovy text-4xl text-gradient-trippy">Industry Insights</h1>
        <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
          Live, aggregated data pulled straight from Canopy Market's catalog and AI budtender
          activity — what people are searching for, where dispensaries are concentrated, and
          what's trending.
        </p>
      </div>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="rounded-2xl border border-canopy-border bg-canopy-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-canopy-muted">
            Strain type mix ({totalStrains} strains)
          </h2>
          <div className="space-y-3">
            {Object.entries(typeCounts).map(([type, count]) => (
              <div key={type}>
                <div className="mb-1 flex justify-between text-sm">
                  <span>{type}</span>
                  <span className="text-canopy-muted">{count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-canopy-bg">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-canopy-green to-canopy-lime"
                    style={{ width: `${(count / totalStrains) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-2xl border border-canopy-border bg-canopy-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-canopy-muted">
            Dispensaries by state
          </h2>
          <div className="space-y-3">
            {Object.entries(stateCounts)
              .sort((a, b) => b[1] - a[1])
              .map(([state, count]) => (
                <div key={state}>
                  <div className="mb-1 flex justify-between text-sm">
                    <span>{state}</span>
                    <span className="text-canopy-muted">{count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-canopy-bg">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-canopy-purple to-canopy-pink"
                      style={{ width: `${(count / maxState) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-canopy-border bg-canopy-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-canopy-muted">
            Top-rated strains
          </h2>
          <ol className="space-y-2 text-sm">
            {topRated.map((s: any, i: number) => (
              <li key={s.name} className="flex justify-between">
                <span>
                  {i + 1}. {s.name}
                </span>
                <span className="text-canopy-muted">
                  ★ {s.rating} · {s.review_count.toLocaleString()} reviews
                </span>
              </li>
            ))}
          </ol>
        </div>

        <div className="rounded-2xl border border-canopy-border bg-canopy-card p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-canopy-muted">
            Most common AI budtender searches ({totalSearches} logged)
          </h2>
          <div className="space-y-2">
            {topQueries.map(([q, count]) => (
              <div key={q}>
                <div className="mb-1 flex justify-between text-sm">
                  <span className="truncate pr-2">{q}</span>
                  <span className="shrink-0 text-canopy-muted">{count}</span>
                </div>
                <div className="h-2 w-full rounded-full bg-canopy-bg">
                  <div
                    className="h-2 rounded-full bg-gradient-to-r from-canopy-gold to-canopy-green"
                    style={{ width: `${(count / maxQuery) * 100}%` }}
                  />
                </div>
              </div>
            ))}
            {topQueries.length === 0 && (
              <p className="text-sm text-canopy-muted">No searches logged yet — check back soon.</p>
            )}
          </div>
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-canopy-muted">
        Figures update in real time as strains, dispensaries, and AI budtender searches are added.
        Early data may include a small set of seed entries used to bootstrap this page.
      </p>
    </div>
  );
}
