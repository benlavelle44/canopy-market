import Link from 'next/link';
import { Strain } from '@/lib/types';
import TypeBadge from './TypeBadge';
import StrainThumb from './StrainThumb';

export default function StrainCard({ strain }: { strain: Strain }) {
  return (
    <Link
      href={`/strains/${strain.slug}`}
      className="card-glow-hover group block overflow-hidden rounded-2xl border border-canopy-border bg-canopy-card transition hover:border-canopy-green/50"
    >
      <StrainThumb type={strain.type} className="h-32 w-full" />
      <div className="p-4">
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="truncate font-semibold text-canopy-text group-hover:text-canopy-green">
            {strain.name}
          </h3>
          <TypeBadge type={strain.type} />
        </div>
        <div className="mb-2 flex gap-3 text-xs text-canopy-muted">
          <span>THC {strain.thc}%</span>
          <span>CBD {strain.cbd}%</span>
          <span className="flex items-center gap-1">★ {strain.rating}</span>
        </div>
        <div className="flex flex-wrap gap-1">
          {strain.effects.slice(0, 3).map((e) => (
            <span key={e} className="rounded-full bg-canopy-bg px-2 py-0.5 text-[11px] text-canopy-muted">
              {e}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}
