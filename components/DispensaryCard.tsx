import Link from 'next/link';
import { Dispensary } from '@/lib/types';

export default function DispensaryCard({ dispensary }: { dispensary: Dispensary }) {
  return (
    <Link
      href={`/dispensaries/${dispensary.slug}`}
      className={`card-glow-hover group block rounded-2xl border p-5 transition hover:border-canopy-green/50 ${
        dispensary.tier === 'verified'
          ? 'border-canopy-green/50 bg-canopy-card shadow-glowsm'
          : dispensary.tier === 'pro'
          ? 'border-canopy-gold/40 bg-canopy-card'
          : 'border-canopy-border bg-canopy-card'
      }`}
    >
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-1.5">
            <h3 className="font-semibold text-canopy-text group-hover:text-canopy-green">
              {dispensary.name}
            </h3>
            {dispensary.tier === 'verified' && (
              <span title="Verified" className="text-canopy-green">✓</span>
            )}
          </div>
          <p className="text-sm text-canopy-muted">
            {dispensary.city}, {dispensary.state}
          </p>
        </div>
        {dispensary.status === 'pending' && (
          <span className="whitespace-nowrap rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2 py-0.5 text-[11px] font-medium text-yellow-400">
            Pending Verification
          </span>
        )}
      </div>
      {dispensary.description && (
        <p className="line-clamp-2 text-sm text-canopy-muted">{dispensary.description}</p>
      )}
    </Link>
  );
}
