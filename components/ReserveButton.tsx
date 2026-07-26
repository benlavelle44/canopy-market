'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

// The "ask to buy" button that turns menu browsing into a real pickup
// request without any money or shipping touching the platform -- keeps
// this on the right side of the legal line for online cannabis commerce
// while still giving Ben's "Amazon of cannabis" flow a genuine checkout-like
// action instead of just a phone number. Deliberately a sibling of
// FlipProductCard's own Link/flip-button, never nested inside them, so a
// tap here can't also trigger navigation or the photo flip.
export default function ReserveButton({ productId, productName }: { productId: string; productName: string }) {
  const router = useRouter();
  const supabase = createClient();
  const [open, setOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [note, setNote] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'done' | 'error'>('idle');
  const [error, setError] = useState('');

  const startReserve = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      router.push(`/login?next=/dispensaries`);
      return;
    }
    setOpen((v) => !v);
  };

  const submit = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setStatus('loading');
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      router.push('/login');
      return;
    }
    const res = await fetch('/api/reservations/create', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ productId, quantity, note }),
    });
    const data = await res.json();
    if (res.ok) {
      setStatus('done');
    } else {
      setStatus('error');
      setError(data.error || 'Something went wrong.');
    }
  };

  if (status === 'done') {
    return (
      <div
        onClick={(e) => e.stopPropagation()}
        className="rounded-lg border border-canopy-green/40 bg-canopy-green/10 px-3 py-2 text-xs text-canopy-green"
      >
        ✓ Reserved — {productName} is held for pickup. Track it in your account.
      </div>
    );
  }

  return (
    <div onClick={(e) => e.stopPropagation()} className="relative">
      <button
        type="button"
        onClick={startReserve}
        className="w-full rounded-lg border border-canopy-border px-3 py-1.5 text-xs font-medium text-canopy-muted transition hover:border-canopy-green hover:text-canopy-green"
      >
        🛍 Reserve for pickup
      </button>

      {open && (
        <div className="mt-2 space-y-2 rounded-lg border border-canopy-border bg-canopy-panel p-3">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs text-canopy-muted">Quantity</span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuantity((q) => Math.max(1, q - 1));
                }}
                className="h-6 w-6 rounded-full border border-canopy-border text-xs"
              >
                −
              </button>
              <span className="w-4 text-center text-sm">{quantity}</span>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setQuantity((q) => Math.min(99, q + 1));
                }}
                className="h-6 w-6 rounded-full border border-canopy-border text-xs"
              >
                +
              </button>
            </div>
          </div>
          <input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            onClick={(e) => e.stopPropagation()}
            placeholder="Note for the store (optional)"
            maxLength={300}
            className="w-full rounded-lg border border-canopy-border bg-canopy-bg px-2 py-1.5 text-xs focus:border-canopy-green focus:outline-none"
          />
          {error && <p className="text-[11px] text-red-400">{error}</p>}
          <button
            type="button"
            onClick={submit}
            disabled={status === 'loading'}
            className="w-full rounded-lg bg-canopy-green px-3 py-1.5 text-xs font-semibold text-black hover:bg-canopy-greendark disabled:opacity-50"
          >
            {status === 'loading' ? 'Reserving…' : 'Confirm reservation'}
          </button>
        </div>
      )}
    </div>
  );
}
