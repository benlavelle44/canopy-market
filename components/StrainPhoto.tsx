import { StrainType } from '@/lib/types';
import { stockPhotoFor, MACRO_BUD_PHOTO } from '@/lib/stockPhotos';

const TINTS: Record<StrainType, string> = {
  Indica: 'from-canopy-purple/40 via-transparent to-canopy-panel/70',
  Sativa: 'from-canopy-gold/30 via-transparent to-canopy-panel/70',
  Hybrid: 'from-canopy-green/35 via-transparent to-canopy-panel/70',
};

// Real stock photography of healthy cannabis plants, replacing the old
// gradient + emoji placeholder -- "show them off to what it's truly
// supposed to look like when grown properly." A soft brand-color tint and
// the existing leaf-texture overlay keep it consistent with the rest of the
// app's look rather than looking like a bare stock photo.
export default function StrainPhoto({
  type,
  variant = 'card',
  className = '',
}: {
  type: StrainType;
  variant?: 'card' | 'hero';
  className?: string;
}) {
  const src = variant === 'hero' ? MACRO_BUD_PHOTO : stockPhotoFor(type);
  return (
    <div className={`relative overflow-hidden bg-canopy-panel ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={`Healthy ${type} cannabis plant`} className="h-full w-full object-cover" loading="lazy" />
      <div className={`absolute inset-0 bg-gradient-to-t ${TINTS[type]} mix-blend-multiply`} />
      <div className="absolute inset-0 opacity-20 mix-blend-overlay leaf-texture" />
    </div>
  );
}
