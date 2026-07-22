import { NextRequest, NextResponse } from 'next/server';
import { getStripe, MEMBER_PRICE_ENV } from '@/lib/stripe';

export const runtime = 'nodejs';

// Consumer "Canopy+" subscription checkout ($5/mo). Separate from the
// dispensary billing route -- this charges a person, not a business, so the
// Stripe session metadata carries a userId instead of a dispensaryId, and
// the webhook branches on metadata.kind to know which table to update.
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        {
          error:
            'Membership billing is not configured yet. Add STRIPE_SECRET_KEY and STRIPE_PRICE_MEMBER in the Vercel project settings to enable Canopy+.',
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const userId: string = body?.userId;
    const email: string | undefined = body?.email;

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const priceId = process.env[MEMBER_PRICE_ENV];
    if (!priceId) {
      return NextResponse.json(
        { error: `Missing ${MEMBER_PRICE_ENV} env var. Create a recurring $5/mo Price in Stripe and set it in Vercel.` },
        { status: 503 }
      );
    }

    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${origin}/account?upgraded=1`,
      cancel_url: `${origin}/pricing`,
      metadata: { kind: 'member', userId },
      subscription_data: {
        metadata: { kind: 'member', userId },
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('stripe member checkout error', err);
    return NextResponse.json({ error: err.message || 'Failed to start checkout' }, { status: 500 });
  }
}
