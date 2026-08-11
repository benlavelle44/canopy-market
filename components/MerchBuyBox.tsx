'use client';

import { useMemo, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { MerchProduct, MerchVariant } from '@/lib/types';

// Variant picker + buy button for a merch product detail page. Unlike
// ReserveButton (which requires sign-in, since a pickup reservation is tied
// to an account), this allows guest checkout -- Stripe collects the email
// and shipping address itself, same as any ordinary ecommerce checkout.
export default function MerchBuyBox({ product, variants }: { product: MerchProduct; variants: MerchVariant[] }) {
  const supabase = createClient();
  const sizes = useMemo(
    () => Array.from(new Set(variants.map((v) => v.size).filter(Boolean))) as string[],
    [variants]
  );
  const colors = useMemo(
    () => Array.from(new Set(variants.map((v) => v.color).filter(Boolean))) as string[],
    [variants]
  );

  const [size, setSize] = useState<string | null>(sizes[0] || null);
  const [color, setColor] = useState<string | null>(colors[0] || null);
  const [quantity, setQuantity] = useState(1);
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  const selectedVariant = useMemo(() => {
    return (
      variants.find((v) => (size ? v.size === size : true) && (color ? v.color === color : true)) ||
      variants[0] ||
      null
    );
  }, [variants, size, color]);

  if (variants.length === 0) {
    return <p className="text-sm text-canopy-muted">Not available right now — check back soon.</p>;
  }

  const startCheckout = async () => {
    if (!selectedVariant) return;
    setStatus('loading');
    setError('');
    try {
      const { data: sessionData } = await supabase.auth.getSession();
      const user = sessionData.session?.user;
      const res = await fetch('/api/merch/checkout', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          variantId: selectedVariant.id,
          quantity,
          userId: user?.id,
          email: user?.email,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else {
        setStatus('error');
        setError(data.error || 'Something went wrong.');
      }
    } catch {
      setStatus('error');
      setError('Something went wrong.');
    }
  };

  const price = selectedVariant ? `$${(selectedVariant.price_cents / 100).toFixed(2)}` : '';
  const outOfStock = !!selectedVariant && !selectedVariant.in_stock;

  return (
    <div className="space-y-4">
      <p className="text-2xl font-semibold text-canopy-green">{price}</p>

      {colors.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-canopy-muted">Color</p>
          <div className="flex flex-wrap gap-2">
            {colors.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  color === c
                    ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                    : 'border-canopy-border text-canopy-muted hover:border-canopy-green'
                }`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      )}

      {sizes.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-canopy-muted">Size</p>
          <div className="flex flex-wrap gap-2">
            {sizes.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setSize(s)}
                className={`rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                  size === s
                    ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                    : 'border-canopy-border text-canopy-muted hover:border-canopy-green'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-3">
        <span className="text-xs text-canopy-muted">Quantity</span>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-7 w-7 rounded-full border border-canopy-border text-sm"
          >
            −
          </button>
          <span className="w-4 text-center text-sm">{quantity}</span>
          <button
            type="button"
            onClick={() => setQuantity((q) => Math.min(10, q + 1))}
            className="h-7 w-7 rounded-full border border-canopy-border text-sm"
          >
            +
          </button>
        </div>
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button
        type="button"
        onClick={startCheckout}
        disabled={status === 'loading' || outOfStock}
        className="btn-glow w-full rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-4 py-2.5 text-center text-sm font-semibold text-black disabled:opacity-50"
      >
        {outOfStock ? 'Out of stock' : status === 'loading' ? 'Starting checkout…' : 'Buy now'}
      </button>

      <p className="text-xs text-canopy-muted">Ships within the US. Printed on demand by Printful.</p>
    </div>
  );
}
