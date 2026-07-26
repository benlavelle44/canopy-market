import Link from 'next/link';
import { Deal, PRODUCT_CATEGORIES, formatDealDiscount } from '@/lib/types';

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(PRODUCT_CATEGORIES.map((c) => [c.id, c.label]));

export default function DealCard({
  deal,
  dispensaryName,
  dispensarySlug,
}: {
  deal: Deal;
  dispensaryName?: string;
  dispensarySlug?: string;
}) {
  const daysLeft = deal.ends_at
    ? Math.ceil((new Date(deal.ends_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const inner = (
    <div className="rounded-2xl border border-canopy-gold/40 bg-gradient-to-br from-canopy-gold/10 via-canopy-card to-canopy-card p-4 transition hover:border-canopy-gold/70">
      <div className="mb-1 flex items-center justify-between gap-2">
        <span className="rounded-full bg-canopy-gold px-2.5 py-0.5 text-xs font-bold text-black">
          {formatDealDiscount(deal)}
        </span>
        {daysLeft !== null && daysLeft >= 0 && (
          <span className="text-[11px] text-canopy-muted">{daysLeft === 0 ? 'Ends today' : `${daysLeft}d left`}</span>
        )}
      </div>
      <p className="mb-1 font-semibold text-canopy-text">{deal.title}</p>
      {deal.description && <p className="mb-1 text-xs text-canopy-muted">{deal.description}</p>}
      <p className="text-xs text-canopy-muted">
        {deal.category ? `${CATEGORY_LABEL[deal.category] || deal.category} only` : 'Storewide'}
        {dispensaryName ? ` · ${dispensaryName}` : ''}
      </p>
    </div>
  );

  return dispensarySlug ? <Link href={`/dispensaries/${dispensarySlug}`}>{inner}</Link> : inner;
}
