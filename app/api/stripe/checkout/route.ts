import { NextRequest, NextResponse } from 'next/server';
import { getStripe, TIER_PRICE_ENV } from '@/lib/stripe';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        {
          error:
            'Billing is not configured yet. Add STRIPE_SECRET_KEY (and STRIPE_PRICE_PRO / STRIPE_PRICE_VERIFIED) in the Vercel project settings to enable upgrades.',
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const dispensaryId: string = body?.dispensaryId;
    const tier: 'pro' | 'verified' = body?.tier;
    const email: string | undefined = body?.email;

    if (!dispensaryId || (tier !== 'pro' && tier !== 'verified')) {
      return NextResponse.json({ error: 'dispensaryId and a valid tier are required' }, { status: 400 });
    }

    const priceEnvVar = TIER_PRICE_ENV[tier];
    const priceId = process.env[priceEnvVar];
    if (!priceId) {
      return NextResponse.json(
        { error: `Missing ${priceEnvVar} env var. Create a recurring Price in Stripe for the ${tier} tier and set it in Vercel.` },
        { status: 503 }
      );
    }

    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${origin}/dashboard?upgraded=1`,
      cancel_url: `${origin}/pricing`,
      metadata: { kind: 'dispensary', dispensaryId, tier },
      subscription_data: {
        metadata: { kind: 'dispensary', dispensaryId, tier },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('stripe checkout error', err);
    return NextResponse.json({ error: err.message || 'Failed to start checkout' }, { status: 500 });
  }
}
