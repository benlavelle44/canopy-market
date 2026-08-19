'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';

interface Slide {
  badge: string;
  icon: string | { src: string; alt: string };
  title: string;
  subtitle: string;
  cta: string;
  href: string;
  from: string;
  to: string;
}

// Car-dealership-style rotating promo strip -- not the hero, just a thin
// eye-catching band above it for whatever Canopy wants to push right now
// (new features, seasonal pushes, merch drops). Auto-advances, but dots are
// clickable and hovering pauses the timer so it doesn't yank the banner out
// from under someone mid-read. Update SLIDES below whenever there's
// something new to highlight -- no CMS, just edit the array.
const SLIDES: Slide[] = [
  {
    badge: 'NEW',
    icon: { src: '/kief/kief-wave.png', alt: 'Kief' },
    title: 'Meet Kief, your AI budtender',
    subtitle: 'Tell him how you want to feel — he\'ll match you to real strains, dabs, and edibles.',
    cta: 'Ask Kief',
    href: '/assistant',
    from: 'from-canopy-green/20',
    to: 'to-canopy-lime/10',
  },
  {
    badge: 'JUST DROPPED',
    icon: '👕',
    title: 'Canopy Merch is here',
    subtitle: 'Hoodies, tees, and stickers repping Kief. Printed on demand, shipped to your door.',
    cta: 'Shop merch',
    href: '/merch',
    from: 'from-canopy-purple/20',
    to: 'to-canopy-pink/10',
  },
  {
    badge: 'IN SEASON',
    icon: '🍂',
    title: 'Fall harvest is rolling in',
    subtitle: 'Fresh flower from this season\'s harvest is hitting dispensary shelves now.',
    cta: 'Browse strains',
    href: '/strains',
    from: 'from-canopy-gold/20',
    to: 'to-canopy-green/10',
  },
];

const ROTATE_MS = 5500;

export default function HomePromoBanner() {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % SLIDES.length), ROTATE_MS);
    return () => clearInterval(t);
  }, [paused]);

  const slide = SLIDES[index];

  return (
    <div
      className="relative overflow-hidden border-b border-canopy-border"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className={`bg-gradient-to-r ${slide.from} ${slide.to} transition-colors duration-700`}>
        <Link
          href={slide.href}
          className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-4 sm:flex-row sm:justify-between"
        >
          <div className="flex items-center gap-3 text-center sm:text-left">
            <span className="hidden shrink-0 sm:block">
              {typeof slide.icon === 'string' ? (
                <span className="text-3xl">{slide.icon}</span>
              ) : (
                <Image
                  src={slide.icon.src}
                  alt={slide.icon.alt}
                  width={56}
                  height={56}
                  className="h-14 w-14 object-contain drop-shadow-[0_0_12px_rgba(57,255,106,0.35)]"
                />
              )}
            </span>
            <div>
              <span className="mr-2 inline-block rounded-full bg-canopy-bg/60 px-2 py-0.5 text-[10px] font-bold tracking-wide text-canopy-green">
                {slide.badge}
              </span>
              <span className="font-groovy text-base text-canopy-text sm:text-lg">{slide.title}</span>
              <span className="block text-xs text-canopy-muted sm:inline sm:text-sm">
                {' '}
                {slide.subtitle}
              </span>
            </div>
          </div>
          <span className="btn-glow shrink-0 whitespace-nowrap rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-5 py-2 text-xs font-semibold text-black sm:text-sm">
            {slide.cta} →
          </span>
        </Link>
      </div>

      <div className="flex justify-center gap-1.5 bg-canopy-bg/40 py-1.5">
        {SLIDES.map((s, i) => (
          <button
            key={s.title}
            onClick={() => setIndex(i)}
            aria-label={`Show: ${s.title}`}
            className={`h-1.5 rounded-full transition-all ${
              i === index ? 'w-5 bg-canopy-green' : 'w-1.5 bg-canopy-border'
            }`}
          />
        ))}
      </div>
    </div>
  );
}
