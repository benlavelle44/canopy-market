import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { listSyncProducts, getSyncProduct } from '@/lib/printful';
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

      const { data: existing } = await admin
        .from('merch_products')
        .select('id, slug')
        .eq('printful_sync_product_id', sp.id)
        .maybeSingle();

      let productId: string;
      let slug: string;
      if (existing) {
        productId = existing.id;
        slug = existing.slug;
        await admin
          .from('merch_products')
          .update({
            name: sp.name,
            image_url: sp.thumbnail_url || null,
            product_type: productType,
            active: true,
          })
          .eq('id', productId);
      } else {
        slug = slugify(sp.name);
        const { data: inserted, error: insertErr } = await admin
          .from('merch_products')
          .insert({
            slug,
            name: sp.name,
            design_slug: 'not-lost-just-elevated',
            product_type: productType,
            image_url: sp.thumbnail_url || null,
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
