import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerReadClient } from '@/lib/supabaseServer';
import { Strain, Dispensary, Product } from '@/lib/types';
import { terpeneSimilarStrains } from '@/lib/recommend';
import TypeBadge from '@/components/TypeBadge';
import StrainThumb from '@/components/StrainThumb';
import StrainCard from '@/components/StrainCard';
import FavoriteButton from '@/components/FavoriteButton';
import ReviewsSection from '@/components/ReviewsSection';

export const revalidate = 0;

async function getStrain(slug: string) {
  const supabase = createServerReadClient();
  const { data: strain } = await supabase.from('strains').select('*').eq('slug', slug).maybeSingle();
  if (!strain) return null;

  const { data: products } = await supabase
    .from('products')
    .select('*, dispensaries!inner(*)')
    .eq('strain_id', strain.id)
    .eq('category', 'flower')
    .eq('dispensaries.status', 'approved');

  const { data: similar } = await supabase
    .from('strains')
    .select('*')
    .eq('type', strain.type)
    .neq('id', strain.id)
    .limit(4);

  // Full catalog (minus itself) so terpene-similarity can surface a match
  // from anywhere -- including strains of a different type the shopper (or
  // a dispensary sourcing new inventory) might never have searched for.
  const { data: allStrains } = await supabase.from('strains').select('*').neq('id', strain.id);
  const terpeneMatches = terpeneSimilarStrains(strain as Strain, (allStrains || []) as Strain[], 4);

  return {
    strain: strain as Strain,
    listings: (products || []) as (Product & { dispensaries: Dispensary })[],
    similar: (similar || []) as Strain[],
    terpeneMatches,
  };
}

export default async function StrainDetailPage({ params }: { params: { slug: string } }) {
  const result = await getStrain(params.slug);
  if (!result) notFound();
  const { strain, listings, similar, terpeneMatches } = result;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <StrainThumb type={strain.type} className="h-56 w-full rounded-2xl md:h-full" />

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{strain.name}</h1>
            <TypeBadge type={strain.type} />
          </div>
          <p className="mb-4 text-sm text-canopy-muted">
            ★ {strain.rating} · {strain.review_count.toLocaleString()} reviews · THC {strain.thc}% · CBD{' '}
            {strain.cbd}%
          </p>
          <p className="mb-5 text-canopy-text">{strain.description}</p>

          <FavoriteButton strainId={strain.id} />

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-canopy-muted">
                Effects
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {strain.effects.map((e) => (
                  <span key={e} className="rounded-full bg-canopy-card px-2.5 py-1 text-xs">
                    {e}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-canopy-muted">
                May help with
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {strain.symptoms.map((s) => (
                  <span key={s} className="rounded-full bg-canopy-card px-2.5 py-1 text-xs">
                    {s}
                  </span>
                ))}
              </div>
            </div>
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-canopy-muted">
                Terpenes
              </h3>
              <div className="space-y-1 text-xs text-canopy-muted">
                {strain.terpenes.map((t) => (
                  <div key={t.name} className="flex justify-between">
                    <span>{t.name}</span>
                    <span>{(t.percentage * 100).toFixed(0)}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <section className="mt-12">
        <h2 className="mb-4 text-xl font-semibold">Available at</h2>
        {listings.length === 0 ? (
          <p className="text-sm text-canopy-muted">
            No dispensaries on Canopy currently list this strain.{' '}
            <Link href="/dispensary-signup" className="text-canopy-green hover:underline">
              List yours
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {listings.map((l) => (
              <div
                key={l.id}
                className="flex items-center justify-between rounded-xl border border-canopy-border bg-canopy-card p-4"
              >
                <div>
                  <Link href={`/dispensaries/${l.dispensaries.slug}`} className="font-medium hover:text-canopy-green">
                    {l.dispensaries.name}
                  </Link>
                  <p className="text-xs text-canopy-muted">
                    {l.dispensaries.city}, {l.dispensaries.state}
                    {l.price ? ` · $${l.price}` : ''}
                  </p>
                </div>
                {l.dispensaries.website_url && (
                  <a
                    href={l.dispensaries.website_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-glow whitespace-nowrap rounded-full bg-gradient-to-r from-canopy-green to-canopy-lime px-4 py-1.5 text-xs font-semibold text-black"
                  >
                    Order Now
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {terpeneMatches.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-1 text-xl font-semibold">Similar terpene profile</h2>
          <p className="mb-4 text-sm text-canopy-muted">
            Matched by chemistry, not just category -- these share {strain.name}'s dominant terpenes
            even when the strain type is different.
          </p>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {terpeneMatches.map((m) => (
              <div key={m.strain.id}>
                <StrainCard strain={m.strain} />
                {m.sharedTerpenes.length > 0 && (
                  <p className="mt-1.5 text-center text-[11px] text-canopy-muted">
                    Shares {m.sharedTerpenes.slice(0, 2).join(', ')} · {(m.similarity * 100).toFixed(0)}% match
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {similar.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-xl font-semibold">More {strain.type} strains</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            {similar.map((s) => (
              <StrainCard key={s.id} strain={s} />
            ))}
          </div>
        </section>
      )}

      <ReviewsSection strainId={strain.id} />
    </div>
  );
}
