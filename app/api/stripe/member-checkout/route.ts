import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { getStripe, MEMBER_PRICE_ENV } from '@/lib/stripe';

export const runtime = 'nodejs';

// userId used to come straight from the request body -- anyone could POST
// someone else's userId and have Canopy+ attached to that account (paid for
// by whoever hit the endpoint, but attributed to a user who never
// authorized it). Now derived from the caller's own auth token, same
// pattern as app/api/strains/review/route.ts.
async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

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

    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    const userId = user.id;

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
      customer_email: user.email || undefined,
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
