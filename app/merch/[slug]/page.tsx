import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { MerchProduct, MerchVariant, MERCH_PRODUCT_TYPE_LABELS } from '@/lib/types';
import { SITE_URL } from '@/lib/siteConfig';
import MerchBuyBox from '@/components/MerchBuyBox';
import MerchGallery from '@/components/MerchGallery';

export const revalidate = 0;

const getMerchProduct = cache(async (slug: string) => {
  const supabase = createServerReadClient();
  const { data: product } = await supabase
    .from('merch_products')
    .select('*')
    .eq('slug', slug)
    .eq('active', true)
    .maybeSingle();
  if (!product) return null;

  const { data: variants } = await supabase
    .from('merch_variants')
    .select('*')
    .eq('product_id', product.id)
    .order('created_at', { ascending: true });

  return { product: product as MerchProduct, variants: (variants || []) as MerchVariant[] };
});

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const result = await getMerchProduct(slug);
  if (!result) return { title: 'Merch not found' };
  const { product } = result;
  return {
    title: `${product.name} — Canopy Merch`,
    description:
      product.description || `Official Canopy Market ${MERCH_PRODUCT_TYPE_LABELS[product.product_type].toLowerCase()}.`,
    alternates: { canonical: `${SITE_URL}/merch/${product.slug}` },
  };
}

export default async function MerchProductPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const result = await getMerchProduct(slug);
  if (!result) notFound();
  const { product, variants } = result;

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="grid gap-8 md:grid-cols-2">
        <MerchGallery name={product.name} mainImage={product.image_url} mockups={product.mockup_urls} />
        <div>
          <span className="mb-2 inline-block rounded-full border border-canopy-border px-2.5 py-0.5 text-xs text-canopy-muted">
            {MERCH_PRODUCT_TYPE_LABELS[product.product_type]}
          </span>
          <h1 className="mb-2 text-3xl font-bold">{product.name}</h1>
          {product.description && <p className="mb-6 text-canopy-muted">{product.description}</p>}
          <MerchBuyBox product={product} variants={variants} />
        </div>
      </div>
    </div>
  );
}
