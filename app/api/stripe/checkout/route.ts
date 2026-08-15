import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { getStripe, TIER_PRICE_ENV } from '@/lib/stripe';

export const runtime = 'nodejs';

// Who's paying and which dispensary gets upgraded both used to come straight
// from the request body -- anyone could POST an arbitrary dispensaryId and
// upgrade a dispensary they don't own, or spoof the customer_email shown to
// Stripe. Now the user is derived from their auth token (same pattern as
// app/api/strains/review/route.ts) and ownership of dispensaryId is
// verified server-side before a Checkout session is ever created.
async function getUserFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  if (!token) return null;
  const supabase = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return null;
  return data.user;
}

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

    const user = await getUserFromRequest(req);
    if (!user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const body = await req.json();
    const dispensaryId: string = body?.dispensaryId;
    const tier: 'pro' | 'verified' = body?.tier;

    if (!dispensaryId || (tier !== 'pro' && tier !== 'verified')) {
      return NextResponse.json({ error: 'dispensaryId and a valid tier are required' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });
    const { data: dispensary } = await admin
      .from('dispensaries')
      .select('id, owner_id')
      .eq('id', dispensaryId)
      .maybeSingle();
    if (!dispensary || dispensary.owner_id !== user.id) {
      return NextResponse.json({ error: 'You do not have access to that dispensary.' }, { status: 403 });
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
      customer_email: user.email || undefined,
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
