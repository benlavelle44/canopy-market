import { NextRequest, NextResponse } from 'next/server';
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '@/lib/supabaseConfig';
import { createAdminClient } from '@/lib/supabaseAdmin';
import { ReservationStatus } from '@/lib/types';

export const runtime = 'nodejs';

const VALID: ReservationStatus[] = ['pending', 'confirmed', 'ready', 'completed', 'cancelled'];

const STATUS_COPY: Record<ReservationStatus, { title: string; body: (name: string) => string }> = {
  pending: { title: 'Reservation pending', body: () => '' },
  confirmed: {
    title: 'Your reservation was confirmed',
    body: (name) => `${name} is being held for you.`,
  },
  ready: {
    title: 'Ready for pickup',
    body: (name) => `${name} is ready — come grab it.`,
  },
  completed: {
    title: 'Pickup complete',
    body: (name) => `Thanks for picking up ${name}.`,
  },
  cancelled: {
    title: 'Reservation cancelled',
    body: (name) => `Your reservation for ${name} was cancelled.`,
  },
};

// Dispensary owner moves a reservation through its lifecycle. Routed through
// the server (not a direct client update, even though the owner's own RLS
// policy would allow the update itself) because notifying the *customer*
// of the change means writing to someone else's row.
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
    const reservationId: string = body?.reservationId;
    const status: ReservationStatus = body?.status;
    if (!reservationId || !VALID.includes(status)) {
      return NextResponse.json({ error: 'reservationId and a valid status are required.' }, { status: 400 });
    }

    const admin = createAdminClient();
    if (!admin) return NextResponse.json({ error: 'Server misconfigured.' }, { status: 500 });

    const { data: reservation } = await admin
      .from('reservations')
      .select('id, user_id, product_id, dispensary_id, dispensaries(owner_id), products(name)')
      .eq('id', reservationId)
      .maybeSingle();

    if (!reservation) return NextResponse.json({ error: 'Reservation not found.' }, { status: 404 });
    const dispensary = (reservation as any).dispensaries as { owner_id: string | null } | null;
    if (!dispensary || dispensary.owner_id !== user.id) {
      return NextResponse.json({ error: 'You do not manage this reservation.' }, { status: 403 });
    }

    const { error } = await admin
      .from('reservations')
      .update({ status, updated_at: new Date().toISOString() })
      .eq('id', reservationId);
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    const productName = ((reservation as any).products as { name: string } | null)?.name || 'your item';
    const copy = STATUS_COPY[status];
    if (copy.body(productName)) {
      await admin.from('notifications').insert({
        user_id: reservation.user_id,
        type: 'reservation_update',
        title: copy.title,
        body: copy.body(productName),
        link: '/account#reservations',
      });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('reservation status error', err);
    return NextResponse.json({ error: 'Something went wrong.' }, { status: 500 });
  }
}
