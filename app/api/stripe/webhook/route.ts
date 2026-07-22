import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  const admin = createAdminClient();

  if (!stripe || !webhookSecret || !admin) {
    // Billing (or the service-role key needed to apply results) isn't
    // configured yet -- ack with 200 so Stripe doesn't retry forever, but
    // do nothing.
    return NextResponse.json({ received: true, skipped: true });
  }

  const sig = req.headers.get('stripe-signature');
  const rawBody = await req.text();

  let event;
  try {
    event = stripe.webhooks.constructEvent(rawBody, sig || '', webhookSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed', err.message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session: any = event.data.object;
        const kind = session.metadata?.kind || 'dispensary';
        if (kind === 'member') {
          const userId = session.metadata?.userId;
          if (userId) {
            await admin
              .from('profiles')
              .update({
                member_tier: 'plus',
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                subscription_status: 'active',
              })
              .eq('id', userId);
            // Welcome bonus for joining Canopy+
            await admin.rpc('increment_points', { target_user: userId, amount: 10 });
          }
        } else {
          const dispensaryId = session.metadata?.dispensaryId;
          const tier = session.metadata?.tier;
          if (dispensaryId && tier) {
            await admin
              .from('dispensaries')
              .update({
                tier,
                stripe_customer_id: session.customer,
                stripe_subscription_id: session.subscription,
                subscription_status: 'active',
              })
              .eq('id', dispensaryId);
          }
        }
        break;
      }
      case 'customer.subscription.updated': {
        const sub: any = event.data.object;
        const kind = sub.metadata?.kind || 'dispensary';
        if (kind === 'member') {
          const userId = sub.metadata?.userId;
          if (userId) {
            await admin.from('profiles').update({ subscription_status: sub.status }).eq('id', userId);
          }
        } else {
          const dispensaryId = sub.metadata?.dispensaryId;
          if (dispensaryId) {
            await admin
              .from('dispensaries')
              .update({ subscription_status: sub.status })
              .eq('id', dispensaryId);
          }
        }
        break;
      }
      case 'customer.subscription.deleted': {
        const sub: any = event.data.object;
        const kind = sub.metadata?.kind || 'dispensary';
        if (kind === 'member') {
          const userId = sub.metadata?.userId;
          if (userId) {
            await admin
              .from('profiles')
              .update({ member_tier: 'free', subscription_status: 'canceled' })
              .eq('id', userId);
          }
        } else {
          const dispensaryId = sub.metadata?.dispensaryId;
          if (dispensaryId) {
            await admin
              .from('dispensaries')
              .update({ tier: 'free', subscription_status: 'canceled' })
              .eq('id', dispensaryId);
          }
        }
        break;
      }
      default:
        break;
    }
  } catch (err) {
    console.error('Error applying webhook event', err);
  }

  return NextResponse.json({ received: true });
}
