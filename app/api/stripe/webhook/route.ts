import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '@/lib/stripe';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { createPrintfulOrder } from '@/lib/printful';

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
        if (kind === 'credits') {
          // One-time AI budtender credit pack purchase -- no subscription
          // involved, just add the purchased credits. Uses the
          // increment_ai_credits() RPC (atomic add) rather than a plain
          // update, since a duplicate Stripe webhook retry re-running a
          // read-then-write here could double-credit a purchase.
          const userId = session.metadata?.userId;
          const credits = Number(session.metadata?.credits || 0);
          if (userId && credits > 0) {
            await admin.rpc('increment_ai_credits', { target_user: userId, amount: credits });
          }
        } else if (kind === 'member') {
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
        } else if (kind === 'merch') {
          // Physical merch order -- record it, then submit to Printful for
          // fulfillment. Draft (unconfirmed) by default in Printful; see
          // lib/printful.ts for the AUTO_CONFIRM_PRINTFUL_ORDERS gate.
          const variantId = session.metadata?.variantId;
          const quantity = Number(session.metadata?.quantity || 1);
          const userId = session.metadata?.userId || null;

          if (variantId) {
            const shipping = session.shipping_details || session.shipping || null;
            const address = shipping?.address || null;
            const totalCents = session.amount_total ?? 0;

            const { data: order, error: orderErr } = await admin
              .from('merch_orders')
              .insert({
                user_id: userId || null,
                stripe_session_id: session.id,
                status: 'pending',
                customer_email: session.customer_details?.email || session.customer_email || null,
                shipping_name: shipping?.name || null,
                shipping_address: address,
                subtotal_cents: totalCents,
                shipping_cents: 0,
                total_cents: totalCents,
              })
              .select('id')
              .single();

            if (orderErr) {
              console.error('merch_orders insert error', orderErr);
            } else if (order) {
              const { data: variant } = await admin
                .from('merch_variants')
                .select('price_cents, printful_sync_variant_id')
                .eq('id', variantId)
                .maybeSingle();

              await admin.from('merch_order_items').insert({
                order_id: order.id,
                variant_id: variantId,
                quantity,
                unit_price_cents: variant?.price_cents || 0,
              });

              if (variant?.printful_sync_variant_id && address) {
                try {
                  const printfulOrder = await createPrintfulOrder({
                    externalId: order.id,
                    recipient: {
                      name: shipping?.name || session.customer_details?.name || 'Customer',
                      address1: address.line1 || '',
                      address2: address.line2 || undefined,
                      city: address.city || '',
                      state_code: address.state || '',
                      country_code: address.country || 'US',
                      zip: address.postal_code || '',
                      email: session.customer_details?.email || undefined,
                    },
                    items: [{ sync_variant_id: variant.printful_sync_variant_id, quantity }],
                  });

                  if (printfulOrder) {
                    await admin
                      .from('merch_orders')
                      .update({ status: 'submitted', printful_order_id: printfulOrder.id })
                      .eq('id', order.id);
                  } else {
                    await admin
                      .from('merch_orders')
                      .update({
                        status: 'failed',
                        fulfillment_error: 'Printful is not configured (missing PRINTFUL_API_KEY).',
                      })
                      .eq('id', order.id);
                  }
                } catch (err: any) {
                  console.error('createPrintfulOrder error', err);
                  await admin
                    .from('merch_orders')
                    .update({ status: 'failed', fulfillment_error: err.message || 'Printful order submission failed.' })
                    .eq('id', order.id);
                }
              } else {
                await admin
                  .from('merch_orders')
                  .update({
                    status: 'failed',
                    fulfillment_error: 'Missing shipping address or Printful variant mapping.',
                  })
                  .eq('id', order.id);
              }
            }
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
