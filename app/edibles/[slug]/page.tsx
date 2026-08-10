import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { getShopperState } from '@/lib/shopperState';
import { Edible, Product, Dispensary } from '@/lib/types';
import { SITE_URL } from '@/lib/siteConfig';

export const revalidate = 0;

// Educational "learn more" page for an edible/tincture/topical type (Gummy,
// Tincture - Oil, Topical - Balm, etc.) -- the mg-dosed counterpart to
// /concentrates/[slug]. Linked to from any product card on a dispensary
// storefront whose product has an edible_id.
const getEdible = cache(async (slug: string) => {
  const supabase = createServerReadClient();
  const { data: edible } = await supabase.from('edibles').select('*').eq('slug', slug).maybeSingle();
  if (!edible) return null;

  const { data: products } = await supabase
    .from('products')
    .select('*, dispensaries!inner(*)')
    .eq('edible_id', edible.id)
    .eq('dispensaries.status', 'approved');

  return {
    edible: edible as Edible,
    listings: (products || []) as (Product & { dispensaries: Dispensary })[],
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getEdible(slug);
  if (!result) return { title: 'Not found' };
  const { edible } = result;
  const title = `${edible.name} — Dosing & Effects Guide`;
  const description = (edible.description || edible.why_choose_this || '').slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/edibles/${edible.slug}` },
  };
}

export default async function EdibleDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getEdible(slug);
  if (!result) notFound();
  const { edible: e, listings } = result;

  const shopperState = await getShopperState();
  const scopedListings = shopperState ? listings.filter((l) => l.dispensaries.state === shopperState) : listings;

  const infoRows: [string, string][] = [];
  if (e.dosage_mg != null || e.cbd_mg != null) {
    infoRows.push([
      'Typical dose',
      [e.dosage_mg != null ? `${e.dosage_mg}mg THC` : null, e.cbd_mg != null ? `${e.cbd_mg}mg CBD` : null]
        .filter(Boolean)
        .join(' / '),
    ]);
  }
  if (e.onset_time) infoRows.push(['Onset time', e.onset_time]);
  if (e.duration) infoRows.push(['Duration', e.duration]);
  if (e.ingredients) infoRows.push(['Typical ingredients', e.ingredients]);
  if (e.allergens.length > 0) infoRows.push(['Common allergens', e.allergens.join(', ')]);

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-canopy-gold/40 bg-canopy-gold/10 px-2.5 py-0.5 text-xs font-medium text-canopy-gold">
          {e.category}
        </span>
        {e.beginner_friendly && (
          <span className="rounded-full border border-canopy-green/40 bg-canopy-green/10 px-2.5 py-0.5 text-xs font-medium text-canopy-green">
            Beginner friendly
          </span>
        )}
      </div>
      <h1 className="mb-2 text-3xl font-bold">{e.name}</h1>
      <p className="mb-4 text-sm text-canopy-muted">
        ★ {e.rating} {e.review_count > 0 ? `· ${e.review_count.toLocaleString()} reviews` : ''}
      </p>
      {e.description && <p className="mb-4 text-canopy-text">{e.description}</p>}

      {e.why_choose_this && (
        <div className="mb-6 rounded-xl border border-canopy-green/30 bg-canopy-green/10 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-canopy-green">Why choose this</p>
          <p className="text-sm text-canopy-text">{e.why_choose_this}</p>
        </div>
      )}

      {(e.best_for.length > 0 || e.effects.length > 0) && (
        <div className="mb-6 space-y-3">
          {e.best_for.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-canopy-muted">Best for</p>
              <div className="flex flex-wrap gap-1.5">
                {e.best_for.map((b) => (
                  <span key={b} className="rounded-full bg-canopy-card px-2.5 py-1 text-xs text-canopy-text">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          {e.effects.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-canopy-muted">Effects</p>
              <div className="flex flex-wrap gap-1.5">
                {e.effects.map((eff) => (
                  <span
                    key={eff}
                    className="rounded-full border border-canopy-border px-2.5 py-1 text-xs text-canopy-muted"
                  >
                    {eff}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {infoRows.length > 0 && (
        <div className="mb-8 rounded-xl border border-canopy-border bg-canopy-card p-4">
          <dl className="grid gap-3 sm:grid-cols-2">
            {infoRows.map(([label, value]) => (
              <div key={label}>
                <dt className="text-[11px] uppercase tracking-wide text-canopy-muted">{label}</dt>
                <dd className="text-sm text-canopy-text">{value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      <section>
        <h2 className="mb-4 text-xl font-semibold">
          Available at{shopperState ? ` in ${shopperState}` : ''}
        </h2>
        {scopedListings.length === 0 ? (
          <p className="text-sm text-canopy-muted">
            {listings.length > 0 && shopperState
              ? `No dispensaries in ${shopperState} currently list this yet.`
              : 'No dispensaries on Canopy currently list this yet.'}{' '}
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
                    {l.name}
                  </Link>
                  <p className="text-xs text-canopy-muted">
                    {l.dispensaries.name} · {l.dispensaries.city}, {l.dispensaries.state}
                    {l.price ? ` · $${l.price}` : ''}
                    {l.thc ? ` · THC ${l.thc}mg` : ''}
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

      <p className="mt-8 rounded-xl border border-canopy-border bg-canopy-card px-4 py-2.5 text-xs text-canopy-muted">
        General educational information about this product type, not a lab report on any specific
        product. Actual potency and onset time vary by product, batch, and body chemistry -- start
        low and go slow. Check the dispensary's own lab results for exact numbers. Not medical
        advice.
      </p>
    </div>
  );
}
