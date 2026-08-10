import Link from 'next/link';
import { createServerReadClient } from '@/lib/supabaseServer';
import { getShopperState } from '@/lib/shopperState';
import { Strain, Dispensary } from '@/lib/types';
import StrainCard from '@/components/StrainCard';
import DispensaryCard from '@/components/DispensaryCard';

export const revalidate = 0;

async function getData(shopperState: string | null) {
  const supabase = createServerReadClient();
  let dispQuery = supabase.from('dispensaries').select('*').eq('status', 'approved').order('name').limit(3);
  let dispCountQuery = supabase.from('dispensaries').select('*', { count: 'exact', head: true }).eq('status', 'approved');
  // "Dispensaries on Canopy" and the dispensary count stat are what a
  // shopper reads as "my options" -- those need to be scoped to their
  // confirmed state (cannabis can't cross state lines). The stateCount
  // stat and hero badge below stay unscoped on purpose: they describe
  // Canopy's overall footprint, not a specific shopper's options.
  if (shopperState) {
    dispQuery = dispQuery.eq('state', shopperState);
    dispCountQuery = dispCountQuery.eq('state', shopperState);
  }

  const [{ data: featured }, { data: dispensaries }, { count: strainCount }, { count: dispCount }, { data: stateRows }] =
    await Promise.all([
      supabase.from('strains').select('*').eq('featured', true).limit(6),
      dispQuery,
      supabase.from('strains').select('*', { count: 'exact', head: true }),
      dispCountQuery,
      supabase.from('dispensaries').select('state').eq('status', 'approved'),
    ]);

  // The hero used to hardcode "Montana's home for..." regardless of what
  // was actually listed -- this platform is multi-state (AZ/CA/CO/IL/MI/
  // MT/NY as of writing), so the badge/count below are computed live
  // instead of claiming a single-state footprint that isn't true.
  const stateCount = new Set((stateRows || []).map((d: any) => d.state)).size;

  return {
    featured: (featured || []) as Strain[],
    dispensaries: (dispensaries || []) as Dispensary[],
    strainCount: strainCount || 0,
    dispCount: dispCount || 0,
    stateCount,
  };
}

export default async function HomePage() {
  const shopperState = await getShopperState();
  const { featured, dispensaries, strainCount, dispCount, stateCount } = await getData(shopperState);

  return (
    <div>
      <section className="relative overflow-hidden border-b border-canopy-border">
        <div className="absolute inset-0 bg-gradient-to-br from-canopy-green/10 via-transparent to-canopy-purple/10" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center">
          <span className="mb-4 inline-block rounded-full border border-canopy-border bg-canopy-card px-4 py-1 text-xs font-medium text-canopy-muted">
            🏔️ Started in Montana{stateCount > 1 ? ` — now in ${stateCount} states` : ''}
          </span>
          <h1 className="mx-auto max-w-3xl font-groovy text-4xl leading-tight md:text-6xl">
            Your home for{' '}
            <span className="text-gradient-trippy">flower, dabs, edibles & education.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-canopy-muted">
            Tell Kief, our AI budtender, how you want to feel. He'll match you to real strains and
            products, explain the science behind why they work, and show you exactly which local
            dispensaries carry them — flower, prerolls, concentrates, vapes, edibles, tinctures,
            topicals, and accessories, all in one place.
          </p>

          <form action="/assistant" className="mx-auto mt-8 flex max-w-xl gap-2">
            <input
              name="q"
              placeholder='Try "something to help me sleep" or "energizing but not too strong"'
              className="w-full rounded-full border border-canopy-border bg-canopy-panel px-5 py-3 text-sm text-canopy-text placeholder:text-canopy-muted focus:border-canopy-green focus:outline-none"
            />
            <button className="btn-glow whitespace-nowrap rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-6 py-3 text-sm font-semibold text-black">
              Ask Kief
            </button>
          </form>

          <div className="mt-6 flex justify-center gap-8 text-sm text-canopy-muted">
            <div>
              <span className="text-xl font-bold text-canopy-text">{strainCount}+</span> strains
            </div>
            <div>
              <span className="text-xl font-bold text-canopy-text">{dispCount}+</span> dispensaries
              {shopperState ? ` in ${shopperState}` : ''}
            </div>
            <div>
              <span className="text-xl font-bold text-canopy-text">{stateCount}</span> states
            </div>
            <div>
              <span className="text-xl font-bold text-canopy-text">24/7</span> AI matching
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-semibold">Featured strains</h2>
          <Link href="/strains" className="text-sm text-canopy-green hover:underline">
            Browse all →
          </Link>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          {featured.map((s) => (
            <StrainCard key={s.id} strain={s} />
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-4 py-14">
        <div className="mb-6 flex items-end justify-between">
          <h2 className="text-2xl font-semibold">
            Dispensaries on Canopy{shopperState ? ` in ${shopperState}` : ''}
          </h2>
          <Link href="/dispensaries" className="text-sm text-canopy-green hover:underline">
            View directory →
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          {dispensaries.map((d) => (
            <DispensaryCard key={d.id} dispensary={d} />
          ))}
        </div>
      </section>

      <section className="border-t border-canopy-border bg-canopy-panel py-16">
        <div className="mx-auto max-w-4xl px-4 text-center">
          <h2 className="text-2xl font-semibold">Own a dispensary?</h2>
          <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
            Get discovered by customers using AI to find products like yours. Create a free
            storefront, list your menu, and drive orders to your own site.
          </p>
          <Link
            href="/dispensary-signup"
            className="btn-glow mt-6 inline-block rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-6 py-3 font-semibold text-black"
          >
            List Your Dispensary — Free
          </Link>
        </div>
      </section>
    </div>
  );
}
