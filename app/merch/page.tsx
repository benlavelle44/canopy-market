import Link from 'next/link';
import type { Metadata } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { MerchProduct, MerchVariant, MERCH_PRODUCT_TYPE_LABELS } from '@/lib/types';
import { SITE_URL } from '@/lib/siteConfig';

export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Merch — Canopy Market',
  description:
    "Official Canopy Market merch featuring Kief, Canopy's AI budtender. Tees, hoodies, hats, and stickers, printed on demand.",
  alternates: { canonical: `${SITE_URL}/merch` },
};

type MerchListItem = MerchProduct & { merch_variants: Pick<MerchVariant, 'price_cents' | 'in_stock'>[] };

async function getMerch(): Promise<MerchListItem[]> {
  const supabase = createServerReadClient();
  const { data } = await supabase
    .from('merch_products')
    .select('*, merch_variants(price_cents, in_stock)')
    .eq('active', true)
    .order('created_at', { ascending: true });
  return (data || []) as MerchListItem[];
}

function priceRange(variants: Pick<MerchVariant, 'price_cents' | 'in_stock'>[]): string {
  const inStock = variants.filter((v) => v.in_stock);
  const pool = inStock.length > 0 ? inStock : variants;
  if (pool.length === 0) return '';
  const cents = pool.map((v) => v.price_cents);
  const min = Math.min(...cents);
  const max = Math.max(...cents);
  const fmt = (c: number) => `$${(c / 100).toFixed(2)}`;
  return min === max ? fmt(min) : `${fmt(min)} – ${fmt(max)}`;
}

export default async function MerchPage() {
  const products = await getMerch();

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="font-groovy text-4xl text-gradient-trippy">Canopy Merch</h1>
        <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
          Rep Kief 🦉, Canopy's AI budtender. Printed on demand and shipped straight to your door.
        </p>
      </div>

      {products.length === 0 ? (
        <p className="text-center text-canopy-muted">Merch is on the way — check back soon.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {products.map((p) => (
            <Link
              key={p.id}
              href={`/merch/${p.slug}`}
              className="flex flex-col justify-between rounded-2xl border border-canopy-border bg-canopy-card p-4 transition hover:border-canopy-green/50"
            >
              <div>
                <div className="mb-3 aspect-square overflow-hidden rounded-xl bg-canopy-panel">
                  {p.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={p.image_url} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-4xl">🦉</div>
                  )}
                </div>
                <span className="mb-1 inline-block rounded-full border border-canopy-border px-2 py-0.5 text-[11px] text-canopy-muted">
                  {MERCH_PRODUCT_TYPE_LABELS[p.product_type]}
                </span>
                <h3 className="font-semibold">{p.name}</h3>
              </div>
              <p className="mt-3 font-semibold text-canopy-green">{priceRange(p.merch_variants)}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
