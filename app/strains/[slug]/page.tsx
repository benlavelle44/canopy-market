import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerReadClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { Strain, Dispensary, Product, ResearchSource } from '@/lib/types';
import { terpeneSimilarStrains } from '@/lib/recommend';
import TypeBadge from '@/components/TypeBadge';
import StrainSourceBadge from '@/components/StrainSourceBadge';
import AiEstimateDisclaimer from '@/components/AiEstimateDisclaimer';
import StrainPhoto from '@/components/StrainPhoto';
import VibeChemistry from '@/components/VibeChemistry';
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
    .eq('verification_status', 'verified')
    .neq('id', strain.id)
    .limit(4);

  // Full catalog (minus itself) so terpene-similarity can surface a match
  // from anywhere -- including strains of a different type the shopper (or
  // a dispensary sourcing new inventory) might never have searched for.
  const { data: allStrains } = await supabase
    .from('strains')
    .select('*')
    .eq('verification_status', 'verified')
    .neq('id', strain.id);
  const terpeneMatches = terpeneSimilarStrains(strain as Strain, (allStrains || []) as Strain[], 4);

  // Credit to whoever found this via the AI Strain Finder. profiles is
  // locked down by RLS to each user's own row, so a plain anon-key read
  // can't see someone else's name -- the admin client can, and this is a
  // read-only, single-field lookup purely for display credit.
  let finderName: string | null = null;
  if (strain.found_by_user_id) {
    const admin = createAdminClient();
    if (admin) {
      const { data: finder } = await admin.from('profiles').select('name').eq('id', strain.found_by_user_id).maybeSingle();
      finderName = finder?.name || null;
    }
  }

  return {
    strain: strain as Strain,
    listings: (products || []) as (Product & { dispensaries: Dispensary })[],
    similar: (similar || []) as Strain[],
    terpeneMatches,
    finderName,
  };
}

export default async function StrainDetailPage({ params }: { params: { slug: string } }) {
  const result = await getStrain(params.slug);
  if (!result) notFound();
  const { strain, listings, similar, terpeneMatches, finderName } = result;
  const isCommunityFind = strain.source === 'community_find';

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        <StrainPhoto type={strain.type} variant="hero" className="h-56 w-full rounded-2xl md:h-full" />

        <div>
          <div className="mb-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{strain.name}</h1>
            <TypeBadge type={strain.type} />
            <StrainSourceBadge source={strain.source} verificationStatus={strain.verification_status} />
          </div>
          <p className="mb-4 text-sm text-canopy-muted">
            ★ {strain.rating} · {strain.review_count.toLocaleString()} reviews · THC {strain.thc}% · CBD{' '}
            {strain.cbd}%
            {isCommunityFind && (
              <a href="#disclaimer" className="ml-0.5 text-yellow-400 hover:underline">
                *
              </a>
            )}
          </p>
          <p className="mb-2 text-canopy-text">{strain.description}</p>
          {isCommunityFind && finderName && (
            <p className="mb-5 text-xs text-canopy-muted">🌿 Discovered by {finderName} via the AI Strain Finder</p>
          )}
          {!isCommunityFind && <div className="mb-5" />}

          <FavoriteButton strainId={strain.id} />

          <div className="mt-6">
            <VibeChemistry strain={strain} />
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

      {isCommunityFind && (
        <div className="mt-12">
          <AiEstimateDisclaimer id="disclaimer" sources={(strain.research_sources || []) as ResearchSource[]} />
        </div>
      )}

      <ReviewsSection strainId={strain.id} />
    </div>
  );
}
