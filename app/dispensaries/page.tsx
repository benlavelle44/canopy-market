import Link from 'next/link';
import { createServerReadClient } from '@/lib/supabaseServer';
import { getShopperState } from '@/lib/shopperState';
import { Dispensary } from '@/lib/types';
import DispensaryCard from '@/components/DispensaryCard';

export const revalidate = 0;

const TIER_RANK: Record<string, number> = { verified: 0, pro: 1, free: 2 };

async function getDispensaries(state?: string) {
  const supabase = createServerReadClient();
  let query = supabase.from('dispensaries').select('*').order('name');
  if (state) query = query.eq('state', state);
  const { data } = await query;
  const list = (data || []) as Dispensary[];
  // Paid tiers get priority placement -- this is the actual value a Pro or
  // Verified subscription buys.
  return list.sort((a, b) => (TIER_RANK[a.tier || 'free'] ?? 2) - (TIER_RANK[b.tier || 'free'] ?? 2));
}

// Unscoped list of every state that has a listing, purely to populate the
// filter pills -- separate from the (possibly state-scoped) main query so
// picking a different state to browse still shows the full pill list.
async function getAllStates() {
  const supabase = createServerReadClient();
  const { data } = await supabase.from('dispensaries').select('state');
  return Array.from(new Set((data || []).map((d: any) => d.state))).sort();
}

export default async function DispensariesPage({
  searchParams,
}: {
  // Next.js 15: searchParams is now a Promise -- must be awaited before use.
  searchParams: Promise<{ state?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const shopperState = await getShopperState();
  // An explicit ?state= always wins -- lets someone research another
  // state's market informationally (Canopy never processes the actual
  // order; that always happens on the dispensary's own site). "All states"
  // is its own explicit choice (?state=all), distinct from "no choice
  // made yet," which is what makes the default state below.
  const requestedState = resolvedSearchParams.state;
  const effectiveState = requestedState === 'all' ? undefined : requestedState || shopperState || undefined;
  const [dispensaries, states] = await Promise.all([getDispensaries(effectiveState), getAllStates()]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Dispensary Directory</h1>
          <p className="mt-1 text-canopy-muted">
            Browse licensed storefronts and order directly from their own site.
          </p>
        </div>
        <Link
          href="/dispensary-signup"
          className="rounded-full bg-canopy-green px-5 py-2.5 text-sm font-semibold text-black hover:bg-canopy-greendark"
        >
          List Your Dispensary
        </Link>
      </div>

      {shopperState && requestedState !== 'all' && (
        <p className="mb-3 text-xs text-canopy-muted">
          Showing dispensaries licensed in {shopperState} -- your confirmed state. Browsing another
          state is informational only; every order still happens on that dispensary's own site.
        </p>
      )}

      <div className="mb-6 flex flex-wrap gap-2">
        <Link
          href="/dispensaries?state=all"
          className={`rounded-full border px-3 py-1 text-xs ${
            requestedState === 'all'
              ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
              : 'border-canopy-border text-canopy-muted'
          }`}
        >
          All states
        </Link>
        {states.map((s) => (
          <Link
            key={s}
            href={`/dispensaries?state=${s}`}
            className={`rounded-full border px-3 py-1 text-xs ${
              effectiveState === s
                ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                : 'border-canopy-border text-canopy-muted'
            }`}
          >
            {s}
          </Link>
        ))}
      </div>

      {dispensaries.length === 0 ? (
        <p className="text-canopy-muted">No dispensaries yet in that state.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {dispensaries.map((d) => (
            <DispensaryCard key={d.id} dispensary={d} />
          ))}
        </div>
      )}
    </div>
  );
}
