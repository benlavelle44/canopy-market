'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { StrainPhoto, GROW_STAGES } from '@/lib/types';
import GrowPhotoUpload from './GrowPhotoUpload';

interface PhotoWithRating extends StrainPhoto {
  avgRating: number;
  ratingCount: number;
  myRating: number;
}

const STAGE_LABEL: Record<string, string> = Object.fromEntries(GROW_STAGES.map((s) => [s.id, s.label]));

// The "My Google Business page, but for grows" feature -- anyone can add a
// real photo of the strain, and the community rates them, so a shopper can
// tell a genuine 5-star pro grow from a rough 2-star home grow at a glance,
// instead of every strain page showing one anonymous stock image.
export default function GrowPhotoGallery({ strainId }: { strainId: string }) {
  const supabase = createClient();
  const [photos, setPhotos] = useState<PhotoWithRating[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<'top' | 'new'>('top');

  const load = async () => {
    const { data: photoRows } = await supabase
      .from('strain_photos')
      .select('*')
      .eq('strain_id', strainId)
      .eq('verification_status', 'verified')
      .order('created_at', { ascending: false });
    const list = (photoRows || []) as StrainPhoto[];

    let ratingsByPhoto: Record<string, number[]> = {};
    let mine: Record<string, number> = {};
    if (list.length > 0) {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id ?? null;
      const { data: ratingRows } = await supabase
        .from('strain_photo_ratings')
        .select('photo_id, user_id, rating')
        .in(
          'photo_id',
          list.map((p) => p.id)
        );
      for (const r of (ratingRows || []) as any[]) {
        ratingsByPhoto[r.photo_id] = ratingsByPhoto[r.photo_id] || [];
        ratingsByPhoto[r.photo_id].push(r.rating);
        if (uid && r.user_id === uid) mine[r.photo_id] = r.rating;
      }

      const ids = Array.from(new Set(list.map((p) => p.submitted_by)));
      const { data: lb } = await supabase.from('leaderboard').select('id, name').in('id', ids);
      const map: Record<string, string> = {};
      for (const row of lb || []) map[(row as any).id] = (row as any).name;
      setNames(map);
    }

    const withRatings: PhotoWithRating[] = list.map((p) => {
      const ratings = ratingsByPhoto[p.id] || [];
      const avgRating = ratings.length ? ratings.reduce((s, r) => s + r, 0) / ratings.length : 0;
      return { ...p, avgRating, ratingCount: ratings.length, myRating: mine[p.id] || 0 };
    });
    setPhotos(withRatings);
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strainId]);

  const rate = async (photoId: string, rating: number) => {
    if (!userId) return;
    await supabase.from('strain_photo_ratings').upsert({ photo_id: photoId, user_id: userId, rating }, { onConflict: 'photo_id,user_id' });
    load();
  };

  const sorted = [...photos].sort((a, b) => {
    if (sort === 'new') return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
    if (b.avgRating !== a.avgRating) return b.avgRating - a.avgRating;
    if (b.ratingCount !== a.ratingCount) return b.ratingCount - a.ratingCount;
    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

  return (
    <section className="mt-12">
      <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-xl font-semibold">Real grow photos</h2>
        <GrowPhotoUpload strainId={strainId} onSubmitted={load} />
      </div>
      <p className="mb-4 text-sm text-canopy-muted">
        Submitted by growers and shoppers, rated by the community -- the top-rated ones are the real deal.
      </p>

      {photos.length > 1 && (
        <div className="mb-4 flex gap-2">
          <button
            onClick={() => setSort('top')}
            className={`rounded-full border px-3 py-1 text-xs ${
              sort === 'top' ? 'border-canopy-green bg-canopy-green/15 text-canopy-green' : 'border-canopy-border text-canopy-muted'
            }`}
          >
            🏆 Top Rated
          </button>
          <button
            onClick={() => setSort('new')}
            className={`rounded-full border px-3 py-1 text-xs ${
              sort === 'new' ? 'border-canopy-green bg-canopy-green/15 text-canopy-green' : 'border-canopy-border text-canopy-muted'
            }`}
          >
            Newest
          </button>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-canopy-muted">Loading photos…</p>
      ) : sorted.length === 0 ? (
        <p className="text-sm text-canopy-muted">
          No real grow photos yet -- be the first to add one and earn 15 points once it's verified.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {sorted.map((p) => {
            const isPro = p.avgRating >= 4.5 && p.ratingCount >= 3;
            return (
              <div key={p.id} className="overflow-hidden rounded-xl border border-canopy-border bg-canopy-card">
                <div className="relative aspect-square">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.image_url} alt={p.caption || 'Grow photo'} className="h-full w-full object-cover" />
                  {isPro && (
                    <span className="absolute left-2 top-2 rounded-full bg-canopy-gold/90 px-2 py-0.5 text-[10px] font-bold text-black">
                      🏆 Pro Grow
                    </span>
                  )}
                  <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[10px] text-white">
                    {STAGE_LABEL[p.grow_stage] || p.grow_stage}
                  </span>
                </div>
                <div className="p-2.5">
                  <p className="truncate text-xs font-medium text-canopy-text">
                    {p.credit_name || names[p.submitted_by] || 'Canopy member'}
                  </p>
                  {p.caption && <p className="mb-1 truncate text-[11px] text-canopy-muted">{p.caption}</p>}
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <button
                        key={n}
                        type="button"
                        disabled={!userId}
                        onClick={() => rate(p.id, n)}
                        className={`text-xs ${n <= (p.myRating || Math.round(p.avgRating)) ? 'text-canopy-gold' : 'text-canopy-border'} ${userId ? 'cursor-pointer' : 'cursor-default'}`}
                      >
                        ★
                      </button>
                    ))}
                    {p.ratingCount > 0 && <span className="ml-1 text-[10px] text-canopy-muted">({p.ratingCount})</span>}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
}
