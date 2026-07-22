'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { Review } from '@/lib/types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export default function ReviewsSection({ strainId }: { strainId: string }) {
  const supabase = createClient();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('reviews')
      .select('*')
      .eq('strain_id', strainId)
      .order('created_at', { ascending: false });
    const list = (data || []) as Review[];
    setReviews(list);

    // Profiles are private (owner-only RLS), so reviewer display names come
    // from the public leaderboard view instead of joining profiles directly.
    const ids = Array.from(new Set(list.map((r) => r.user_id)));
    if (ids.length > 0) {
      const { data: lb } = await supabase.from('leaderboard').select('id, name').in('id', ids);
      const map: Record<string, string> = {};
      for (const row of lb || []) map[(row as any).id] = (row as any).name;
      setNames(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setUserId(data.session?.user?.id ?? null));
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strainId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setNotice('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ strainId, rating, body }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setNotice(data.error || 'Could not submit your review.');
      return;
    }
    setNotice(
      data.awardedPoints
        ? `Thanks! You earned ${data.awardedPoints} community points.`
        : 'Review updated.'
    );
    setBody('');
    load();
  };

  return (
    <section className="mt-12">
      <h2 className="mb-4 text-xl font-semibold">Community reviews</h2>

      {userId ? (
        <form onSubmit={submit} className="mb-6 rounded-2xl border border-canopy-border bg-canopy-card p-4">
          <div className="mb-3 flex items-center gap-2">
            <span className="text-sm text-canopy-muted">Your rating</span>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                type="button"
                key={n}
                onClick={() => setRating(n)}
                className={n <= rating ? 'text-canopy-gold' : 'text-canopy-border'}
              >
                ★
              </button>
            ))}
          </div>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="What was your experience like?"
            rows={2}
            className="mb-3 w-full rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
          />
          {notice && <p className="mb-2 text-xs text-canopy-green">{notice}</p>}
          <button
            disabled={submitting}
            className="rounded-full bg-canopy-green px-4 py-2 text-xs font-semibold text-black hover:bg-canopy-greendark disabled:opacity-50"
          >
            {submitting ? 'Posting…' : 'Post review (+5 points)'}
          </button>
        </form>
      ) : (
        <p className="mb-6 text-sm text-canopy-muted">
          <a href="/login" className="text-canopy-green hover:underline">
            Sign in
          </a>{' '}
          to leave a review and earn community points.
        </p>
      )}

      {loading ? (
        <p className="text-sm text-canopy-muted">Loading reviews…</p>
      ) : reviews.length === 0 ? (
        <p className="text-sm text-canopy-muted">No community reviews yet — be the first.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-canopy-border bg-canopy-card p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">{names[r.user_id] || 'Canopy member'}</span>
                <span className="text-xs text-canopy-muted">{timeAgo(r.created_at)}</span>
              </div>
              <div className="mb-1 text-canopy-gold">{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</div>
              {r.body && <p className="text-sm text-canopy-muted">{r.body}</p>}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
