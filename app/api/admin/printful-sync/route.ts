import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { listSyncProducts, getSyncProduct } from '@/lib/printful';
import type { PrintfulSyncProductDetail } from '@/lib/printful';
import type { MerchProductType } from '@/lib/types';

export const runtime = 'nodejs';

// Pulls Ben's Printful catalog (sync products + their variants/prices) into
// merch_products/merch_variants, so he can create products in the Printful
// dashboard and hit this endpoint instead of hand-typing sync IDs and
// prices. Same admin-check pattern as app/api/strains/review/route.ts --
// re-verifies profiles.is_admin server-side on every call rather than
// trusting a client-side check.
//
// Safe to re-run: upserts by printful_sync_product_id / printful_sync_variant_id,
// so running it again after Ben edits prices in Printful just refreshes the
// existing rows instead of duplicating them.

async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

// Best-effort product-type inference from the name Ben gives the product in
// the Printful dashboard -- there's no reliable structured field for this on
// a sync product, so this just pattern-matches common naming. Worth a quick
// glance at the sync response after the first run in case any product needs
// its product_type corrected by hand in Supabase.
const TYPE_KEYWORDS: [RegExp, MerchProductType][] = [
  [/hoodie|sweatshirt/i, 'hoodie'],
  [/hat|cap|beanie/i, 'hat'],
  [/sticker|decal/i, 'sticker'],
  [/shirt|tee/i, 'tshirt'],
];

function inferProductType(name: string): MerchProductType {
  for (const [re, type] of TYPE_KEYWORDS) {
    if (re.test(name)) return type;
  }
  return 'tshirt';
}

// Maps a Printful product name to one of Ben's actual Kief artwork files in
// public/kief/merch/ -- this is what actually shows as the product photo
// instead of Printful's on-model mockup, since the mockup is too small/
// distant to read the graphic. Order matters: more specific phrases first
// so e.g. "whoo knows your strain" doesn't get caught by a looser "knows"
// pattern meant for "knows what time it is".
const DESIGN_MATCHERS: [RegExp, string, string][] = [
  [/not\s*lost/i, 'not-lost-just-elevated', '/kief/merch/kief-not-lost-just-elevated-white-bg.png'],
  [/clocked\s*out/i, 'clocked-out-lit-up', '/kief/merch/kief-clocked-out-lit-up.png'],
  [/fall\s*for\s*better\s*flower/i, 'fall-for-better-flower', '/kief/merch/kief-fall-for-better-flower.png'],
  [/fally|f[*c]?ckin/i, 'its-fckin-fally', '/kief/merch/kief-its-fckin-fally.png'],
  [/hangin/i, 'just-hangin-out', '/kief/merch/kief-just-hangin-out.png'],
  [/whoo\s*knows|knows\s*your\s*strain/i, 'whoo-knows-your-strain', '/kief/merch/kief-whoo-knows-your-strain.png'],
  [/knows\s*what\s*time/i, 'knows-what-time-it-is', '/kief/merch/kief-knows-what-time-it-is.png'],
  [/these\s*buds/i, 'these-buds-are-for-you', '/kief/merch/kief-these-buds-are-for-you.png'],
  [/too\s*hot|give\s*a\s*hoot/i, 'too-hot-to-give-a-hoot', '/kief/merch/kief-too-hot-to-give-a-hoot.png'],
];

function matchDesign(productName: string): { slug: string; image: string } | null {
  for (const [re, slug, image] of DESIGN_MATCHERS) {
    if (re.test(productName)) return { slug, image };
  }
  return null;
}

// Pulls a representative set of mockup images (front/back, on-model) off the
// first variant that has any files, so the product page can show them
// alongside the graphic-only image above. Deduped by URL since Printful
// often repeats the same preview across variants/placements.
function extractMockups(detail: PrintfulSyncProductDetail): { type: string; url: string }[] {
  const seen = new Set<string>();
  const mockups: { type: string; url: string }[] = [];
  for (const v of detail.sync_variants) {
    for (const f of v.files || []) {
      const url = f.preview_url || f.thumbnail_url;
      if (!url || seen.has(url)) continue;
      seen.add(url);
      mockups.push({ type: f.type, url });
    }
    if (mockups.length > 0) break; // one variant's worth is enough
  }
  return mockups.slice(0, 6);
}

function slugify(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const KNOWN_SIZES = new Set(['XS', 'S', 'M', 'L', 'XL', '2XL', '3XL', '4XL', '5XL', 'ONE SIZE', 'OS']);

// Printful sync variant names are typically "<Product name> / <Color> /
// <Size>" but the exact shape varies by product type (stickers/hats often
// skip color or size). Best-effort parsing -- Ben should spot-check
// merch_variants after a sync and fix any mix-ups by hand.
function parseVariantName(fullName: string, productName: string): { size: string | null; color: string | null } {
  const rest = fullName.replace(productName, '').trim();
  const parts = rest
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  let size: string | null = null;
  let color: string | null = null;
  for (const part of parts) {
    if (KNOWN_SIZES.has(part.toUpperCase())) {
      size = part;
    } else if (!color) {
      color = part;
    }
  }
  return { size, color };
}

export async function POST(req: NextRequest) {
  try {
    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: profile } = await admin.from('profiles').select('is_admin').eq('id', user.id).maybeSingle();
    if (!profile?.is_admin) return NextResponse.json({ error: 'Not authorized.' }, { status: 403 });

    let syncProducts;
    try {
      syncProducts = await listSyncProducts();
    } catch (err: any) {
      console.error('printful listSyncProducts error', err);
      return NextResponse.json({ error: err.message || 'Printful request failed.' }, { status: 502 });
    }
    if (syncProducts === null) {
      return NextResponse.json(
        { error: 'PRINTFUL_API_KEY is not set. Add it in the Vercel project settings.' },
        { status: 503 }
      );
    }
    if (syncProducts.length === 0) {
      return NextResponse.json({ error: 'No products found in your Printful store yet.' }, { status: 404 });
    }

    const results: { product: string; productType: MerchProductType; variantCount: number; slug: string }[] = [];

    for (const sp of syncProducts) {
      let detail;
      try {
        detail = await getSyncProduct(sp.id);
      } catch (err: any) {
        console.error(`printful getSyncProduct(${sp.id}) error`, err);
        continue;
      }
      if (!detail) continue;

      const productType = inferProductType(sp.name);
      const design = matchDesign(sp.name);
      const mockups = extractMockups(detail);
      // Graphic-only art wins for the main product photo when we recognize
      // the design (that's what's actually legible at thumbnail size);
      // falls back to Printful's on-model mockup for anything we can't
      // match, e.g. the wordmark-only hat/beanie.
      const imageUrl = design?.image || sp.thumbnail_url || null;

      const { data: existing } = await admin
        .from('merch_products')
        .select('id, slug')
        .eq('printful_sync_product_id', sp.id)
        .maybeSingle();

      let productId: string;
      let slug: string;
      if (existing) {
        // Re-syncing a Printful product we already know about.
        productId = existing.id;
        slug = existing.slug;
        await admin
          .from('merch_products')
          .update({
            name: sp.name,
            image_url: imageUrl,
            mockup_urls: mockups,
            design_slug: design?.slug || 'wordmark',
            product_type: productType,
            active: true,
          })
          .eq('id', productId);
      } else {
        // Ben builds light-garment (black ink) and dark-garment (white ink)
        // versions of the same design as two separate Printful products
        // with the identical name, since Printful's "different file per
        // color" editor has been unreliable for him. Same name = same
        // logical product on the storefront: fold this product's variants
        // into the existing row instead of creating a second listing, so
        // shoppers see one page with the full color range rather than two
        // near-duplicate "Kief Hoodie" cards.
        const { data: sibling } = await admin
          .from('merch_products')
          .select('id, slug')
          .eq('name', sp.name)
          .maybeSingle();

        if (sibling) {
          productId = sibling.id;
          slug = sibling.slug;
        } else {
          const baseSlug = slugify(sp.name);
          const { data: slugTaken } = await admin
            .from('merch_products')
            .select('id')
            .eq('slug', baseSlug)
            .maybeSingle();
          slug = slugTaken ? `${baseSlug}-${sp.id}` : baseSlug;

          const { data: inserted, error: insertErr } = await admin
            .from('merch_products')
            .insert({
              slug,
              name: sp.name,
              design_slug: design?.slug || 'wordmark',
              product_type: productType,
              image_url: imageUrl,
              mockup_urls: mockups,
              printful_sync_product_id: sp.id,
              active: true,
            })
            .select('id, slug')
            .single();
          if (insertErr || !inserted) {
            console.error('merch product insert error', insertErr);
            continue;
          }
          productId = inserted.id;
          slug = inserted.slug;
        }
      }

      let variantCount = 0;
      for (const v of detail.sync_variants) {
        if (v.is_ignored) continue;
        const { size, color } = parseVariantName(v.name, sp.name);
        const priceCents = Math.round(parseFloat(v.retail_price || '0') * 100);

        const { data: existingVariant } = await admin
          .from('merch_variants')
          .select('id')
          .eq('printful_sync_variant_id', v.id)
          .maybeSingle();

        if (existingVariant) {
          await admin
            .from('merch_variants')
            .update({ size, color, price_cents: priceCents, printful_variant_id: v.variant_id, in_stock: true })
            .eq('id', existingVariant.id);
        } else {
          await admin.from('merch_variants').insert({
            product_id: productId,
            size,
            color,
            price_cents: priceCents,
            printful_sync_variant_id: v.id,
            printful_variant_id: v.variant_id,
            in_stock: true,
          });
        }
        variantCount++;
      }

      results.push({ product: sp.name, productType, variantCount, slug });
    }

    return NextResponse.json({ ok: true, synced: results });
  } catch (err: any) {
    console.error('printful sync error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
