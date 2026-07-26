import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';

export const runtime = 'nodejs';

// Marking a product back in stock is a normal RLS-protected client update
// for the dispensary itself -- but fanning a notification out to every
// shopper who favorited that strain means writing to other users' rows,
// which has to go through the service-role client. Only fires when this is
// a real false -> true transition, so re-saving an already-in-stock item
// (e.g. just changing its price) never re-spams anyone.

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
    if (!productId) return NextResponse.json({ error: 'productId is required.' }, { status: 400 });

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: product } = await admin
      .from('products')
      .select('id, in_stock, strain_id, name, dispensary_id, dispensaries(name, owner_id), strains(name, slug)')
      .eq('id', productId)
      .maybeSingle();

    if (!product) return NextResponse.json({ error: 'Product not found.' }, { status: 404 });
    const dispensary = (product as any).dispensaries as { name: string; owner_id: string | null } | null;
    if (!dispensary || dispensary.owner_id !== user.id) {
      return NextResponse.json({ error: 'You do not own this listing.' }, { status: 403 });
    }

    const wasOutOfStock = !product.in_stock;

    const { error } = await admin.from('products').update({ in_stock: true }).eq('id', productId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    if (!wasOutOfStock || !product.strain_id) {
      return NextResponse.json({ ok: true, notified: 0 });
    }

    const strain = (product as any).strains as { name: string; slug: string } | null;
    const { data: favorites } = await admin.from('favorites').select('user_id').eq('strain_id', product.strain_id);
    const favoriterIds = Array.from(new Set((favorites || []).map((f: any) => f.user_id))).filter(
      (id) => id !== user.id
    );

    if (favoriterIds.length > 0 && strain) {
      await admin.from('notifications').insert(
        favoriterIds.map((uid) => ({
          user_id: uid,
          type: 'back_in_stock',
          title: `${strain.name} is back in stock`,
          body: `${dispensary.name} just restocked it.`,
          link: `/strains/${strain.slug}`,
        }))
      );
    }

    return NextResponse.json({ ok: true, notified: favoriterIds.length });
  } catch (err: any) {
    console.error('restock alert error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
