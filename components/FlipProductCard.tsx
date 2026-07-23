'use client';

import { useState } from 'react';
import Link from 'next/link';

// Wraps a dispensary menu item so shoppers can flip it over and see the
// dispensary's own photo of their actual product -- the stock plant photo
// on the front shows what the strain looks like grown well; the back shows
// what THIS dispensary is really selling. Only renders the flip affordance
// when the dispensary has actually uploaded a photo; otherwise it's a
// no-op passthrough so nothing changes for listings without one.
export default function FlipProductCard({
  imageUrl,
  photoCredit,
  href,
  children,
}: {
  imageUrl?: string | null;
  photoCredit?: string;
  href?: string;
  children: React.ReactNode;
}) {
  const [flipped, setFlipped] = useState(false);

  if (!imageUrl) {
    return href ? <Link href={href}>{children}</Link> : <>{children}</>;
  }

  return (
    <div className="relative" style={{ perspective: '1200px' }}>
      <div
        className="relative transition-transform duration-500"
        style={{ transformStyle: 'preserve-3d', transform: flipped ? 'rotateY(180deg)' : 'rotateY(0deg)' }}
      >
        <div style={{ backfaceVisibility: 'hidden' }}>{href ? <Link href={href}>{children}</Link> : children}</div>

        <div
          className="absolute inset-0 overflow-hidden rounded-xl border border-canopy-border bg-canopy-card"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt="Dispensary's photo of this product" className="h-full w-full object-cover" />
          {photoCredit && (
            <p className="absolute bottom-0 left-0 right-0 bg-black/60 px-2 py-1 text-[10px] text-white">
              📷 {photoCredit}'s actual product
            </p>
          )}
        </div>
      </div>

      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className="absolute right-2 top-2 z-10 rounded-full bg-black/60 px-2 py-1 text-[10px] font-medium text-white backdrop-blur transition hover:bg-black/80"
      >
        {flipped ? '↩ Stock photo' : '📸 Their photo'}
      </button>
    </div>
  );
}
