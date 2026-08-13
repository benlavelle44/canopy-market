'use client';

import { useState } from 'react';
import type { MerchMockupImage } from '@/lib/types';

const MOCKUP_LABELS: Record<string, string> = {
  default: 'Front (mockup)',
  front: 'Front (mockup)',
  back: 'Back (mockup)',
  preview: 'Mockup',
  embroidery_front: 'Front (mockup)',
  embroidery_back: 'Back (mockup)',
};

// Graphic-only art is the main image (what actually sells the design), with
// Printful's on-model mockups available as a secondary strip so shoppers can
// still see fit/scale/back placement. Defaults back to the main graphic if
// there are no mockups to show.
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

      {mockups.length > 0 && (
        <div className="mt-3 flex gap-2 overflow-x-auto">
          {mainImage && (
            <button
              onClick={() => setActive(mainImage)}
              className={`shrink-0 overflow-hidden rounded-lg border bg-canopy-panel p-1 ${
                active === mainImage ? 'border-canopy-green' : 'border-canopy-border'
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={mainImage} alt="Graphic" className="h-16 w-16 object-contain" />
            </button>
          )}
          {mockups.map((m) => (
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
