import Link from 'next/link';
import { createServerReadClient } from '@/lib/supabaseServer';
import { LeaderboardEntry } from '@/lib/types';

export const revalidate = 0;

function badge(entry: LeaderboardEntry) {
  const badges: string[] = [];
  if (entry.member_tier === 'plus') badges.push('Canopy+ Member');
  if (entry.review_count >= 10) badges.push('Certified Rater');
  else if (entry.review_count >= 3) badges.push('Rising Rater');
  if (entry.referral_count >= 5) badges.push('Community Builder');
  else if (entry.referral_count >= 1) badges.push('Promoter');
  return badges;
}

async function getLeaderboards() {
  const supabase = createServerReadClient();
  const [{ data: topPoints }, { data: topRaters }, { data: topPromoters }] = await Promise.all([
    supabase.from('leaderboard').select('*').order('points', { ascending: false }).limit(10),
    supabase.from('leaderboard').select('*').order('review_count', { ascending: false }).limit(10),
    supabase.from('leaderboard').select('*').order('referral_count', { ascending: false }).limit(10),
  ]);
  return {
    topPoints: (topPoints || []) as LeaderboardEntry[],
    topRaters: (topRaters || []) as LeaderboardEntry[],
    topPromoters: (topPromoters || []) as LeaderboardEntry[],
  };
}

function LeaderboardCard({
  title,
  entries,
  stat,
}: {
  title: string;
  entries: LeaderboardEntry[];
  stat: (e: LeaderboardEntry) => string;
}) {
  return (
    <div className="rounded-2xl border border-canopy-border bg-canopy-card p-6">
      <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-canopy-muted">{title}</h2>
      {entries.length === 0 ? (
        <p className="text-sm text-canopy-muted">No activity yet — be the first on the board.</p>
      ) : (
        <ol className="space-y-3 text-sm">
          {entries.map((e, i) => (
            <li key={e.id} className="flex items-center justify-between gap-2">
              <div className="flex min-w-0 items-center gap-2">
                <span className="w-5 shrink-0 text-canopy-muted">{i + 1}.</span>
                <span className="truncate font-medium">{e.name}</span>
                {e.member_tier === 'plus' && (
                  <span className="shrink-0 rounded-full bg-canopy-green/15 px-1.5 py-0.5 text-[10px] text-canopy-green">
                    +
                  </span>
                )}
              </div>
              <span className="shrink-0 text-canopy-muted">{stat(e)}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

export default async function CommunityPage() {
  const { topPoints, topRaters, topPromoters } = await getLeaderboards();

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <div className="mb-10 text-center">
        <h1 className="font-groovy text-4xl text-gradient-trippy">The Canopy Community</h1>
        <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
          Review strains, refer friends, and climb the board. Every review and referral earns
          points — top members get badges and bragging rights.
        </p>
        <div className="mx-auto mt-6 flex max-w-lg flex-wrap justify-center gap-2 text-xs text-canopy-muted">
          <span className="rounded-full border border-canopy-border px-3 py-1">+5 pts per review</span>
          <span className="rounded-full border border-canopy-border px-3 py-1">+20 pts per referral</span>
          <span className="rounded-full border border-canopy-border px-3 py-1">+10 pts joining Canopy+</span>
        </div>
        <div className="mt-6 flex justify-center gap-3">
          <Link
            href="/pricing"
            className="btn-glow rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-5 py-2.5 text-sm font-semibold text-black"
          >
            Join Canopy+ — $5/mo
          </Link>
          <Link
            href="/account"
            className="rounded-full border border-canopy-border px-5 py-2.5 text-sm font-medium hover:border-canopy-green"
          >
            Get your referral link
          </Link>
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <LeaderboardCard title="Top points" entries={topPoints} stat={(e) => `${e.points} pts`} />
        <LeaderboardCard title="Top raters" entries={topRaters} stat={(e) => `${e.review_count} reviews`} />
        <LeaderboardCard
          title="Top promoters"
          entries={topPromoters}
          stat={(e) => `${e.referral_count} referrals`}
        />
      </div>

      <div className="mt-10 grid gap-6 sm:grid-cols-2">
        {[...topRaters]
          .filter((e) => e.review_count >= 3 || e.referral_count >= 1 || e.member_tier === 'plus')
          .slice(0, 4)
          .map((e) => (
            <div key={e.id} className="rounded-2xl border border-canopy-border bg-canopy-panel p-4">
              <p className="mb-2 text-sm font-medium">{e.name}</p>
              <div className="flex flex-wrap gap-1.5">
                {badge(e).map((b) => (
                  <span
                    key={b}
                    className="rounded-full border border-canopy-gold/40 bg-canopy-gold/10 px-2.5 py-0.5 text-[11px] text-canopy-gold"
                  >
                    {b}
                  </span>
                ))}
              </div>
            </div>
          ))}
      </div>
    </div>
  );
}
