import Link from 'next/link';
import { createServerReadClient } from '@/lib/supabaseServer';
import { Strain, Dispensary } from '@/lib/types';
import StrainCard from '@/components/StrainCard';
import DispensaryCard from '@/components/DispensaryCard';

export const revalidate = 0;

async function getData() {
  const supabase = createServerReadClient();
  const [{ data: featured }, { data: dispensaries }, { count: strainCount }, { count: dispCount }] =
    await Promise.all([
      supabase.from('strains').select('*').eq('featured', true).limit(6),
      supabase.from('dispensaries').select('*').eq('status', 'approved').limit(3),
      supabase.from('strains').select('*', { count: 'exact', head: true }),
      supabase.from('dispensaries').select('*', { count: 'exact', head: true }).eq('status', 'approved'),
    ]);

  return {
    featured: (featured || []) as Strain[],
    dispensaries: (dispensaries || []) as Dispensary[],
    strainCount: strainCount || 0,
    dispCount: dispCount || 0,
  };
}

export default async function HomePage() {
  const { featured, dispensaries, strainCount, dispCount } = await getData();

  return (
    <div>
      <section className="relative overflow-hidden border-b border-canopy-border">
        <div className="absolute inset-0 bg-gradient-to-br from-canopy-green/10 via-transparent to-canopy-purple/10" />
        <div className="relative mx-auto max-w-6xl px-4 py-20 text-center">
          <span className="mb-4 inline-block rounded-full border border-canopy-border bg-canopy-card px-4 py-1 text-xs font-medium text-canopy-muted">
            🏔️ Built and rooted in Montana
          </span>
          <h1 className="mx-auto max-w-3xl font-groovy text-4xl leading-tight md:text-6xl">
            Montana's home for{' '}
            <span className="text-gradient-trippy">flower, dabs, edibles & education.</span>
          </h1>
          <p className="mx-auto mt-5 max-w-xl text-canopy-muted">
            Tell our AI budtender how you want to feel. We'll match you to real strains and
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
              Ask the AI
            </button>
          </form>

          <div className="mt-6 flex justify-center gap-8 text-sm text-canopy-muted">
            <div>
              <span className="text-xl font-bold text-canopy-text">{strainCount}+</span> strains
            </div>
            <div>
              <span className="text-xl font-bold text-canopy-text">{dispCount}+</span> dispensaries
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
          <h2 className="text-2xl font-semibold">Dispensaries on Canopy</h2>
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
