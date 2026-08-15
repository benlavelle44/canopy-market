import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { getStripe, CREDIT_PACK_PRICE_ENV } from '@/lib/stripe';

export const runtime = 'nodejs';

// userId used to come straight from the request body -- anyone could POST
// someone else's userId and have credits attributed to that account. Now
// derived from the caller's own auth token, same pattern as
// app/api/strains/review/route.ts.
async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

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

    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    const userId = user.id;

    const body = await req.json();
    const pack: '5' | '15' = body?.pack === '15' ? '15' : '5';

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
      customer_email: user.email || undefined,
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
