import { NextRequest, NextResponse } from 'next/server';
import { getStripe, CREDIT_PACK_PRICE_ENV } from '@/lib/stripe';

export const runtime = 'nodejs';

// One-time AI budtender credit pack checkout ($2.99/5 or $6.99/15).
// Separate from member-checkout (subscription) and dispensary checkout
// (subscription) -- this is a one-time payment, so mode is 'payment' not
// 'subscription', and there's no ongoing subscription_data to attach.
// The webhook adds the credits to the buyer's profile on
// checkout.session.completed by reading metadata.kind === 'credits'.
export async function POST(req: NextRequest) {
  try {
    const stripe = getStripe();
    if (!stripe) {
      return NextResponse.json(
        {
          error:
            'Credit purchases aren\'t configured yet. Add STRIPE_SECRET_KEY and the credit pack Price IDs in the Vercel project settings.',
        },
        { status: 503 }
      );
    }

    const body = await req.json();
    const userId: string = body?.userId;
    const email: string | undefined = body?.email;
    const pack: '5' | '15' = body?.pack === '15' ? '15' : '5';

    if (!userId) {
      return NextResponse.json({ error: 'userId is required' }, { status: 400 });
    }

    const priceEnv = CREDIT_PACK_PRICE_ENV[pack];
    const priceId = process.env[priceEnv];
    if (!priceId) {
      return NextResponse.json(
        {
          error: `Missing ${priceEnv} env var. Create a one-time (not recurring) Price in Stripe for this pack and set it in Vercel.`,
        },
        { status: 503 }
      );
    }

    const credits = pack === '15' ? 15 : 5;
    const origin = req.headers.get('origin') || `https://${req.headers.get('host')}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: email,
      success_url: `${origin}/assistant?credits_added=${credits}`,
      cancel_url: `${origin}/pricing`,
      metadata: { kind: 'credits', userId, credits: String(credits) },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: any) {
    console.error('stripe credits checkout error', err);
    return NextResponse.json({ error: err.message || 'Failed to start checkout' }, { status: 500 });
  }
}
