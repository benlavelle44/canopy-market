import { createServerReadClient } from '@/lib/supabaseServer';
import { Deal, Dispensary } from '@/lib/types';
import DealCard from '@/components/DealCard';

export const revalidate = 0;

async function getActiveDeals() {
  const supabase = createServerReadClient();
  const { data } = await supabase
    .from('deals')
    .select('*, dispensaries!inner(name, slug, city, state, status)')
    .eq('active', true)
    .eq('dispensaries.status', 'approved')
    .order('created_at', { ascending: false });

  const rows = (data || []) as (Deal & { dispensaries: Pick<Dispensary, 'name' | 'slug' | 'city' | 'state'> })[];

  // "Active" alone isn't enough -- a deal with a past ends_at should quietly
  // stop showing up here without the dispensary having to remember to
  // toggle it off manually.
  const now = Date.now();
  return rows.filter((d) => !d.ends_at || new Date(d.ends_at).getTime() >= now);
}

export default async function DealsPage() {
  const deals = await getActiveDeals();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-2 font-groovy text-3xl text-gradient-trippy">🔥 Today's Deals</h1>
      <p className="mb-8 text-canopy-muted">
        Live promotions from dispensaries on Canopy Market -- a reason to check back often.
      </p>

      {deals.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-canopy-border/70 bg-canopy-bg/40 px-6 py-16 text-center">
          <p className="text-canopy-muted">No active deals right now -- check back soon.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {deals.map((d) => (
            <DealCard
              key={d.id}
              deal={d}
              dispensaryName={`${d.dispensaries.name} (${d.dispensaries.city}, ${d.dispensaries.state})`}
              dispensarySlug={d.dispensaries.slug}
            />
          ))}
        </div>
      )}
    </div>
  );
}
