import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createServerReadClient } from '@/lib/supabaseServer';

export const runtime = 'nodejs';

// Merch checkout uses Stripe's dynamic price_data instead of a pre-made
// Stripe Price (unlike the dispensary/member/credits checkouts) because
// merch pricing lives in our own merch_variants table, sourced from
// Printful's per-variant retail_price, not Stripe's product catalog.
// US-only shipping, consistent with the rest of the app staying US-only for
// this cannabis-adjacent brand. Guest checkout is allowed -- unlike
// ReserveButton, buying a t-shirt doesn't need an account.
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        { error: 'Checkout is not configured yet. Add STRIPE_SECRET_KEY in the Vercel project settings.' },
        { status: 503 }
      );
    }

    const body = await req.json();
    const variantId: string = body?.variantId;
    const quantity: number = Math.min(10, Math.max(1, Number(body?.quantity) || 1));
    const userId: string | undefined = body?.userId;
    const email: string | undefined = body?.email;

    if (!variantId) {
      return NextResponse.json({ error: 'variantId is required' }, { status: 400 });
    }

    const supabase = createServerReadClient();
    const { data: variant } = await supabase
      .from('merch_variants')
      .select('*, merch_products(*)')
      .eq('id', variantId)
      .maybeSingle();

    const product: any = (variant as any)?.merch_products;
    if (!variant || !variant.in_stock || !product?.active) {
      return NextResponse.json({ error: 'That item is not available right now.' }, { status: 404 });
    }

    const name = [product.name, (variant as any).color, (variant as any).size].filter(Boolean).join(' — ');
    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            unit_amount: (variant as any).price_cents,
            product_data: {
              name,
              images: product.image_url ? [product.image_url] : undefined,
            },
          },
          quantity,
        },
      ],
      customer_email: email,
      shipping_address_collection: { allowed_countries: ['US'] },
      success_url: `${origin}/merch/${product.slug}?ordered=1`,
      cancel_url: `${origin}/merch/${product.slug}`,
      metadata: { kind: 'merch', variantId, quantity: String(quantity), userId: userId || '' },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('merch checkout error', err);
    return NextResponse.json({ error: err.message || 'Failed to start checkout' }, { status: 500 });
  }
}
