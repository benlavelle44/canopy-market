import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// "Reserve for pickup" -- the Amazon-style ask-to-buy flow without ever
// touching payment or shipping, which keeps this on the right side of the
// legal line for online cannabis commerce. No money moves on the platform;
// this just turns browsing into a real-world action item for the store,
// same as calling ahead. Insert goes through the admin client (not the
// customer's own RLS'd session) purely so we can fan the notification out
// to the dispensary owner's row in the same request.
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization') || '';
    const token = authHeader.replace(/^Bearer\s+/i, '');
    if (!token) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

    const anon = createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    const { data: userData, error: userError } = await anon.auth.getUser(token);
    if (userError || !userData.user) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    const user = userData.user;

    const body = await req.json();
    const productId: string = body?.productId;
    const quantity: number = Math.max(1, Math.min(99, parseInt(body?.quantity, 10) || 1));
    const note: string = (body?.note || '').toString().trim().slice(0, 300);
    if (!productId) return NextResponse.json({ error: 'productId is required.' }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: product } = await admin
      .from('products')
      .select('id, name, dispensary_id, in_stock, dispensaries(name, owner_id)')
      .eq('id', productId)
      .maybeSingle();

    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    if (!product.in_stock) return NextResponse.json({ error: 'This item is out of stock.' }, { status: 400 });

    const dispensary = (product as any).dispensaries as { name: string; owner_id: string | null } | null;

    const { data: reservation, error } = await admin
      .from('reservations')
      .insert({
        dispensary_id: product.dispensary_id,
        product_id: product.id,
        user_id: user.id,
        quantity,
        note: note || null,
      })
      .select('*')
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (dispensary?.owner_id) {
      await admin.from('notifications').insert({
        user_id: dispensary.owner_id,
        type: 'reservation_created',
        title: `New pickup reservation: ${product.name}`,
        body: `Qty ${quantity}${note ? ` — "${note}"` : ''}`,
        link: '/dashboard',
      });
    }

    return NextResponse.json({ ok: true, reservation });
  } catch (err: any) {
    console.error('reservation create error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
