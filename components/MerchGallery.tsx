'use client';

import { useState } from 'react';
import type { MerchMockupImage } from '@/lib/types';

const MOCKUP_LABELS: Record<string, string> = {
  graphic: 'Full design',
  default: 'Front (mockup)',
  front: 'Front (mockup)',
  back: 'Back (mockup)',
  preview: 'Mockup',
  embroidery_front: 'Front (mockup)',
  embroidery_back: 'Back (mockup)',
};

// Main image is the actual product photo -- the garment with the design
// printed on it, so it's obvious what you're buying. The clean graphic and
// any extra mockup angles (back print, etc.) live in the strip below so
// shoppers who want a close look at the art can still get one.
export default function MerchGallery({
  name,
  mainImage,
  mockups,
}: {
  name: string;
  mainImage: string | null;
  mockups: MerchMockupImage[];
}) {
  const [active, setActive] = useState(mainImage);
  const thumbs = mockups.filter((m) => m.url !== mainImage);

  return (
    <div>
      <div className="aspect-square overflow-hidden rounded-2xl bg-canopy-panel p-6">
        {active ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={active} alt={name} className="h-full w-full object-contain" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-6xl">🦉</div>
        )}
      </div>

      {thumbs.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {mainImage && (
            <button
              onClick={() => setActive(mainImage)}
              className={`shrink-0 overflow-hidden rounded-lg border bg-canopy-panel p-1 ${
                active === mainImage ? 'border-canopy-green' : 'border-canopy-border'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImage} alt="Product" className="h-16 w-16 object-contain" />
            </button>
          )}
          {thumbs.map((m) => (
            <button
              key={m.url}
              onClick={() => setActive(m.url)}
              title={MOCKUP_LABELS[m.type] || m.type}
              className={`shrink-0 overflow-hidden rounded-lg border bg-canopy-panel p-1 ${
                active === m.url ? 'border-canopy-green' : 'border-canopy-border'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={m.url} alt={MOCKUP_LABELS[m.type] || m.type} className="h-16 w-16 object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
