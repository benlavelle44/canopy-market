import { cache } from 'react';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { getShopperState } from '@/lib/shopperState';
import { Concentrate, Product, Dispensary } from '@/lib/types';
import { SITE_URL } from '@/lib/siteConfig';

export const revalidate = 0;

// Educational "learn more" page for a concentrate/dab type (Shatter, Live
// Resin, etc.) -- linked to from any product card on a dispensary
// storefront whose product has a concentrate_id. This is generic knowledge
// about the TYPE, not a specific dispensary's specific jar -- "Available
// at" below is what connects it to real, buyable listings.
const getConcentrate = cache(async (slug: string) => {
  const supabase = createServerReadClient();
  const { data: concentrate } = await supabase.from('concentrates').select('*').eq('slug', slug).maybeSingle();
  if (!concentrate) return null;

  const { data: products } = await supabase
    .from('products')
    .select('*, dispensaries!inner(*)')
    .eq('concentrate_id', concentrate.id)
    .eq('dispensaries.status', 'approved');

  return {
    concentrate: concentrate as Concentrate,
    listings: (products || []) as (Product & { dispensaries: Dispensary })[],
  };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const result = await getConcentrate(slug);
  if (!result) return { title: 'Concentrate not found' };
  const { concentrate } = result;
  const title = `${concentrate.name} — Concentrate Guide`;
  const description = (concentrate.description || concentrate.why_choose_this || '').slice(0, 200);
  return {
    title,
    description,
    alternates: { canonical: `${SITE_URL}/concentrates/${concentrate.slug}` },
  };
}

export default async function ConcentrateDetailPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const result = await getConcentrate(slug);
  if (!result) notFound();
  const { concentrate: c, listings } = result;

  const shopperState = await getShopperState();
  const scopedListings = shopperState ? listings.filter((l) => l.dispensaries.state === shopperState) : listings;

  const infoRows: [string, string | null][] = [
    ['Extraction method', c.extraction_method],
    ['Consistency', c.consistency],
    ['Typical THC range', c.typical_thc_range],
    ['Typical terpene range', c.typical_terpene_range],
    ['Flavor notes', c.flavor_notes],
    ['Terpene preservation', c.terpene_preservation],
    ['Shelf stability', c.shelf_stability],
    ['Equipment needed', c.equipment_needed],
  ].filter(([, v]) => !!v) as [string, string | null][];

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 flex flex-wrap items-center gap-3">
        <span className="rounded-full border border-canopy-gold/40 bg-canopy-gold/10 px-2.5 py-0.5 text-xs font-medium text-canopy-gold">
          {c.category}
        </span>
        {c.beginner_friendly && (
          <span className="rounded-full border border-canopy-green/40 bg-canopy-green/10 px-2.5 py-0.5 text-xs font-medium text-canopy-green">
            Beginner friendly
          </span>
        )}
      </div>
      <h1 className="mb-2 text-3xl font-bold">{c.name}</h1>
      <p className="mb-4 text-sm text-canopy-muted">
        ★ {c.rating} {c.review_count > 0 ? `· ${c.review_count.toLocaleString()} reviews` : ''}
      </p>
      {c.description && <p className="mb-4 text-canopy-text">{c.description}</p>}

      {c.why_choose_this && (
        <div className="mb-6 rounded-xl border border-canopy-green/30 bg-canopy-green/10 p-4">
          <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-canopy-green">Why choose this</p>
          <p className="text-sm text-canopy-text">{c.why_choose_this}</p>
        </div>
      )}

      {(c.best_for.length > 0 || c.effects.length > 0) && (
        <div className="mb-6 space-y-3">
          {c.best_for.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-canopy-muted">Best for</p>
              <div className="flex flex-wrap gap-1.5">
                {c.best_for.map((b) => (
                  <span key={b} className="rounded-full bg-canopy-card px-2.5 py-1 text-xs text-canopy-text">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
          {c.effects.length > 0 && (
            <div>
              <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-canopy-muted">Effects</p>
              <div className="flex flex-wrap gap-1.5">
                {c.effects.map((e) => (
                  <span
                    key={e}
                    className="rounded-full border border-canopy-border px-2.5 py-1 text-xs text-canopy-muted"
                  >
                    {e}
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
                    {l.thc ? ` · THC ${l.thc}%` : ''}
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
        General educational information about this concentrate type, not a lab report on any
        specific product. Actual potency, terpenes, and effects vary by product and batch --
        check the dispensary's own lab results for exact numbers. Not medical advice.
      </p>
    </div>
  );
}
