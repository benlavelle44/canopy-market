import { StrainType } from '@/lib/types';

const STYLES: Record<StrainType, string> = {
  Indica: 'bg-purple-500/15 text-purple-300 border-purple-500/30',
  Sativa: 'bg-orange-500/15 text-orange-300 border-orange-500/30',
  Hybrid: 'bg-canopy-green/15 text-canopy-green border-canopy-green/30',
};

export default function TypeBadge({ type }: { type: StrainType }) {
  return (
    <span className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-medium ${STYLES[type]}`}>
      {type}
    </span>
  );
}
