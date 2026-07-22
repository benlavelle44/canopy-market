import { StrainType } from '@/lib/types';

const GRADIENTS: Record<StrainType, string> = {
  Indica: 'from-canopy-purple/50 via-canopy-pink/20 to-canopy-panel',
  Sativa: 'from-canopy-gold/50 via-canopy-green/20 to-canopy-panel',
  Hybrid: 'from-canopy-green/50 via-canopy-lime/25 to-canopy-panel',
};

export default function StrainThumb({ type, className = '' }: { type: StrainType; className?: string }) {
  return (
    <div
      className={`relative flex items-center justify-center overflow-hidden bg-gradient-to-br ${GRADIENTS[type]} ${className}`}
    >
      <div className="absolute inset-0 opacity-30 mix-blend-overlay leaf-texture" />
      <span className="text-4xl opacity-90 drop-shadow-[0_0_12px_rgba(57,255,106,0.6)]">🌿</span>
    </div>
  );
}
