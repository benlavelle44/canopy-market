import { notFound } from 'next/navigation';
import { createServerReadClient } from '@/lib/supabaseServer';
import { Dispensary, Product, Strain, PRODUCT_CATEGORIES } from '@/lib/types';
import TypeBadge from '@/components/TypeBadge';
import DispensaryReviewsSection from '@/components/DispensaryReviewsSection';
import StrainPhoto from '@/components/StrainPhoto';
import FlipProductCard from '@/components/FlipProductCard';

export const revalidate = 0;

const DAY_ORDER = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

async function getDispensary(slug: string) {
  const supabase = createServerReadClient();
  const { data: dispensary } = await supabase
    .from('dispensaries')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!dispensary) return null;

  const [{ data: products }, { data: reviews }] = await Promise.all([
    supabase.from('products').select('*, strains(*)').eq('dispensary_id', dispensary.id).order('category'),
    supabase.from('dispensary_reviews').select('rating').eq('dispensary_id', dispensary.id),
  ]);

  const reviewCount = (reviews || []).length;
  const avgRating = reviewCount > 0 ? (reviews as any[]).reduce((s, r) => s + r.rating, 0) / reviewCount : 0;

  return {
    dispensary: dispensary as Dispensary,
    products: (products || []) as (Product & { strains: Strain | null })[],
    avgRating,
    reviewCount,
  };
}

export default async function DispensaryDetailPage({ params }: { params: { slug: string } }) {
  const result = await getDispensary(params.slug);
  if (!result) notFound();
  const { dispensary, products, avgRating, reviewCount } = result;

  const byCategory = PRODUCT_CATEGORIES.map((c) => ({
    ...c,
    items: [...products.filter((p) => p.category === c.id)].sort((a, b) => Number(b.in_stock) - Number(a.in_stock)),
  })).filter((c) => c.items.length > 0);

  const inStockCount = products.filter((p) => p.in_stock).length;
  const today = DAY_ORDER[new Date().getDay()];
  const mapQuery = encodeURIComponent(
    [dispensary.address, dispensary.city, dispensary.state, dispensary.zip].filter(Boolean).join(', ')
  );

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      {/* Banner + logo -- real photography if the dispensary provided it, gradient fallback otherwise */}
      <div
        className="relative mb-6 h-48 w-full overflow-hidden rounded-2xl bg-gradient-to-br from-canopy-green/20 via-canopy-panel to-canopy-purple/20 bg-cover bg-center"
        style={dispensary.banner_url ? { backgroundImage: `url(${dispensary.banner_url})` } : undefined}
      >
        {dispensary.logo_url && (
          <div className="absolute -bottom-6 left-6 h-20 w-20 overflow-hidden rounded-2xl border-4 border-canopy-bg bg-canopy-card shadow-lg">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={dispensary.logo_url} alt={`${dispensary.name} logo`} className="h-full w-full object-cover" />
          </div>
        )}
      </div>

      <div className={`flex flex-wrap items-start justify-between gap-4 ${dispensary.logo_url ? 'mt-8' : ''}`}>
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold">{dispensary.name}</h1>
            {dispensary.tier === 'verified' && (
              <span
                title="Verified dispensary"
                className="rounded-full border border-canopy-green/50 bg-canopy-green/10 px-2.5 py-0.5 text-xs font-semibold text-canopy-green"
              >
                ✓ Verified
              </span>
            )}
            {dispensary.tier === 'pro' && (
              <span className="rounded-full border border-canopy-gold/40 bg-canopy-gold/10 px-2.5 py-0.5 text-xs font-semibold text-canopy-gold">
                Pro
              </span>
            )}
            {dispensary.status === 'pending' && (
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                Pending Verification
              </span>
            )}
          </div>
          <p className="text-canopy-muted">
            {dispensary.address ? `${dispensary.address}, ` : ''}
            {dispensary.city}, {dispensary.state} {dispensary.zip}
          </p>
          {dispensary.phone && <p className="text-sm text-canopy-muted">{dispensary.phone}</p>}
          <div className="mt-2 flex flex-wrap items-center gap-3 text-sm">
            {reviewCount > 0 ? (
              <span className="text-canopy-gold">
                ★ {avgRating.toFixed(1)} <span className="text-canopy-muted">({reviewCount} reviews)</span>
              </span>
            ) : (
              <span className="text-canopy-muted">No reviews yet</span>
            )}
            {products.length > 0 && (
              <span className="text-canopy-muted">
                <span className="text-canopy-green">{inStockCount}</span> of {products.length} items in stock
              </span>
            )}
          </div>
        </div>
        {dispensary.website_url && (
          <a
            href={dispensary.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-6 py-3 font-semibold text-black"
          >
            Order on their site →
          </a>
        )}
      </div>

      {dispensary.description && <p className="mt-5 max-w-2xl text-canopy-text">{dispensary.description}</p>}

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_280px]">
        <section>
          <h2 className="mb-4 text-xl font-semibold">Menu</h2>
          {products.length === 0 ? (
            <p className="text-sm text-canopy-muted">This dispensary hasn't listed products yet.</p>
          ) : (
            <div className="space-y-6">
              {byCategory.map((c) => (
                <div key={c.id}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-canopy-green">
                    {c.label}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {c.items.map((p) => {
                      const card = (
                        <div
                          className={`flex items-center gap-3 rounded-xl border p-4 transition ${
                            p.in_stock
                              ? 'border-canopy-border bg-canopy-card hover:border-canopy-green/50'
                              : 'border-canopy-border/50 bg-canopy-card/50 opacity-60'
                          }`}
                        >
                          <StrainPhoto
                            type={p.strains?.type || 'Hybrid'}
                            className="h-12 w-12 flex-shrink-0 rounded-lg"
                          />
                          <div className="flex flex-1 items-center justify-between gap-2">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">{p.strains ? p.strains.name : p.name}</span>
                                {p.strains && <TypeBadge type={p.strains.type} />}
                                {!p.in_stock && (
                                  <span className="rounded-full border border-canopy-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-canopy-muted">
                                    Out of stock
                                  </span>
                                )}
                              </div>
                              {p.strains ? (
                                <p className="text-xs text-canopy-muted">
                                  THC {p.strains.thc}% · CBD {p.strains.cbd}%
                                </p>
                              ) : (
                                <>
                                  {p.brand && <span className="text-xs text-canopy-muted">{p.brand}</span>}
                                  {(p.thc || p.cbd) && (
                                    <p className="text-xs text-canopy-muted">
                                      {p.thc ? `THC ${p.thc}%` : ''}
                                      {p.thc && p.cbd ? ' · ' : ''}
                                      {p.cbd ? `CBD ${p.cbd}%` : ''}
                                    </p>
                                  )}
                                </>
                              )}
                            </div>
                            <span
                              className={`whitespace-nowrap font-semibold ${p.in_stock ? 'text-canopy-green' : 'text-canopy-muted'}`}
                            >
                              {p.price ? `$${p.price}` : '—'}
                            </span>
                          </div>
                        </div>
                      );
                      // Flips to the dispensary's own uploaded photo of this
                      // product when they've provided one -- otherwise this
                      // is just a plain (optionally strain-linked) card.
                      return (
                        <FlipProductCard
                          key={p.id}
                          imageUrl={p.image_url}
                          photoCredit={dispensary.name}
                          href={p.strains ? `/strains/${p.strains.slug}` : undefined}
                        >
                          {card}
                        </FlipProductCard>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-canopy-border bg-canopy-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-canopy-muted">
              Hours
            </h3>
            <ul className="space-y-1 text-sm">
              {Object.entries(dispensary.hours || {}).map(([day, hrs]) => (
                <li
                  key={day}
                  className={`flex justify-between ${
                    day.toLowerCase() === today ? 'font-semibold text-canopy-green' : 'text-canopy-muted'
                  }`}
                >
                  <span className="capitalize">{day}</span>
                  <span>{hrs}</span>
                </li>
              ))}
            </ul>
          </div>

          {mapQuery && (
            <div className="overflow-hidden rounded-xl border border-canopy-border">
              <iframe
                title={`Map to ${dispensary.name}`}
                src={`https://www.google.com/maps?q=${mapQuery}&output=embed`}
                width="100%"
                height="200"
                style={{ border: 0 }}
                loading="lazy"
              />
            </div>
          )}

          {dispensary.license_number && (
            <div className="rounded-xl border border-canopy-border bg-canopy-card p-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-canopy-muted">
                License
              </h3>
              <p className="text-sm text-canopy-muted">{dispensary.license_number}</p>
            </div>
          )}
        </aside>
      </div>

      <DispensaryReviewsSection dispensaryId={dispensary.id} ownerId={dispensary.owner_id ?? null} />
    </div>
  );
}
