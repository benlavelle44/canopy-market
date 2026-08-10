import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getShopperState } from '@/lib/shopperState';
import { Strain, Dispensary, Product, ResearchSource } from '@/lib/types';
import { terpeneSimilarStrains } from '@/lib/recommend';
import { SITE_URL } from '@/lib/siteConfig';
import TypeBadge from '@/components/TypeBadge';
import StrainSourceBadge from '@/components/StrainSourceBadge';
import AiEstimateDisclaimer from '@/components/AiEstimateDisclaimer';
import StrainPhoto from '@/components/StrainPhoto';
import VibeChemistry from '@/components/VibeChemistry';
import GrowPhotoGallery from '@/components/GrowPhotoGallery';
import StrainCard from '@/components/StrainCard';
import FavoriteButton from '@/components/FavoriteButton';
import ReviewsSection from '@/components/ReviewsSection';

export const revalidate = 0;

// Wrapped in React's cache() so generateMetadata() and the page component
// share one Supabase round-trip per request instead of fetching the same
// strain twice.
const getStrain = cache(async (slug: string) => {
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

  // Prefer a real, community-verified photo of THIS strain over the generic
  // stock photo -- "Bruce Banner should show a picture of Bruce Banner."
  // Picked by highest average community rating (then rating count, then
  // recency) so a genuine 5-star pro grow wins the hero slot over a rough
  // one-off submission.
  let heroPhotoUrl: string | null = null;
  const { data: verifiedPhotos } = await supabase
    .from('strain_photos')
    .select('id, image_url, created_at')
    .eq('strain_id', strain.id)
    .eq('verification_status', 'verified')
    .order('created_at', { ascending: false });
  if (verifiedPhotos && verifiedPhotos.length > 0) {
    const { data: ratingRows } = await supabase
      .from('strain_photo_ratings')
      .select('photo_id, rating')
      .in(
        'photo_id',
        verifiedPhotos.map((p: any) => p.id)
      );
    const scored = verifiedPhotos.map((p: any) => {
      const ratings = (ratingRows || []).filter((r: any) => r.photo_id === p.id).map((r: any) => r.rating);
      const avg = ratings.length ? ratings.reduce((s: number, r: number) => s + r, 0) / ratings.length : 0;
      return { ...p, avg, count: ratings.length };
    });
    scored.sort((a: any, b: any) => {
      if (b.avg !== a.avg) return b.avg - a.avg;
      if (b.count !== a.count) return b.count - a.count;
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    });
    heroPhotoUrl = scored[0].image_url;
  }

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
    heroPhotoUrl,
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getStrain(slug);
  if (!result) return { title: 'Strain not found' };
  const { strain, heroPhotoUrl } = result;
  const title = `${strain.name} — ${strain.type} Strain`;
  const description = `${strain.name}: THC ${strain.thc}%, CBD ${strain.cbd}%. ${strain.description}`.slice(0, 200);
  const image = heroPhotoUrl || undefined;
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/strains/${strain.slug}` },
    openGraph: {
      title,
      description,
      url: `${SITE_URL}/strains/${strain.slug}`,
      images: image ? [{ url: image }] : undefined,
    },
    twitter: {
      card: image ? 'summary_large_image' : 'summary',
      title,
      description,
      images: image ? [image] : undefined,
    },
  };
}

export default async function StrainDetailPage({
  params,
}: {
  // Next.js 15: params is now a Promise -- must be awaited before use.
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getStrain(slug);
  if (!result) notFound();
  const { strain, listings, similar, terpeneMatches, finderName, heroPhotoUrl } = result;
  const isCommunityFind = strain.source === 'community_find';

  // "Available at" is a direct path toward ordering, so it needs the same
  // state scoping as /shop and the AI budtender -- cannabis can't cross
  // state lines. Filtered here (post-query, in memory) rather than adding
  // a state param to getStrain()/getAllStates() so generateMetadata()
  // above -- which also calls getStrain() and has no reason to care about
  // the shopper's state -- keeps sharing the same cached call.
  const shopperState = await getShopperState();
  const scopedListings = shopperState ? listings.filter((l) => l.dispensaries.state === shopperState) : listings;

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-[280px_1fr]">
        {heroPhotoUrl ? (
          <div className="relative h-56 w-full overflow-hidden rounded-2xl bg-canopy-panel md:h-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={heroPhotoUrl} alt={`Real photo of ${strain.name}`} className="h-full w-full object-cover" />
            <span className="absolute bottom-2 left-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
              📷 Real community photo
            </span>
          </div>
        ) : (
          <StrainPhoto type={strain.type} variant="hero" className="h-56 w-full rounded-2xl md:h-full" />
        )}

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
        <h2 className="mb-4 text-xl font-semibold">
          Available at{shopperState ? ` in ${shopperState}` : ''}
        </h2>
        {scopedListings.length === 0 ? (
          <p className="text-sm text-canopy-muted">
            {listings.length > 0 && shopperState
              ? `No dispensaries in ${shopperState} currently list this strain yet.`
              : 'No dispensaries on Canopy currently list this strain.'}{' '}
            <Link href="/dispensary-signup" className="text-canopy-green hover:underline">
              List yours
            </Link>
            .
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {scopedListings.map((l) => (
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

      <GrowPhotoGallery strainId={strain.id} />

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
