'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';
import { DispensaryReview } from '@/lib/types';

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days < 1) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? '1 month ago' : `${months} months ago`;
}

export default function DispensaryReviewsSection({
  dispensaryId,
  ownerId,
}: {
  dispensaryId: string;
  ownerId: string | null;
}) {
  const supabase = createClient();
  const [reviews, setReviews] = useState<DispensaryReview[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [rating, setRating] = useState(5);
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [notice, setNotice] = useState('');
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');

  const load = async () => {
    const { data } = await supabase
      .from('dispensary_reviews')
      .select('*')
      .eq('dispensary_id', dispensaryId)
      .order('created_at', { ascending: false });
    const list = (data || []) as DispensaryReview[];
    setReviews(list);

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
  }, [dispensaryId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!userId) return;
    setSubmitting(true);
    setNotice('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    const res = await fetch('/api/dispensary-reviews', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ dispensaryId, rating, body }),
    });
    const data = await res.json();
    setSubmitting(false);
    if (!res.ok) {
      setNotice(data.error || 'Could not submit your review.');
      return;
    }
    setNotice(data.awardedPoints ? `Thanks! You earned ${data.awardedPoints} community points.` : 'Review updated.');
    setBody('');
    load();
  };

  const submitReply = async (reviewId: string) => {
    if (!replyText.trim()) return;
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    await fetch('/api/dispensary-reviews/reply', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ reviewId, response: replyText.trim() }),
    });
    setReplyingTo(null);
    setReplyText('');
    load();
  };

  const avgRating = reviews.length ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const isOwner = !!ownerId && !!userId && ownerId === userId;

  return (
    <section className="mt-12">
      <div className="mb-4 flex items-center gap-3">
        <h2 className="text-xl font-semibold">Shopper Reviews</h2>
        {reviews.length > 0 && (
          <span className="text-sm text-canopy-muted">
            <span className="text-canopy-gold">★ {avgRating.toFixed(1)}</span> ({reviews.length}{' '}
            {reviews.length === 1 ? 'review' : 'reviews'})
          </span>
        )}
      </div>

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
            placeholder="How was your experience with this dispensary?"
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
        <p className="text-sm text-canopy-muted">No shopper reviews yet — be the first.</p>
      ) : (
        <div className="space-y-3">
          {reviews.map((r) => (
            <div key={r.id} className="rounded-xl border border-canopy-border bg-canopy-card p-4">
              <div className="mb-1 flex items-center justify-between">
                <span className="text-sm font-medium">{names[r.user_id] || 'Canopy member'}</span>
                <span className="text-xs text-canopy-muted">{timeAgo(r.created_at)}</span>
              </div>
              <div className="mb-1 text-canopy-gold">
                {'★'.repeat(r.rating)}
                {'☆'.repeat(5 - r.rating)}
              </div>
              {r.body && <p className="text-sm text-canopy-muted">{r.body}</p>}

              {r.owner_response ? (
                <div className="mt-3 rounded-lg border border-canopy-green/30 bg-canopy-green/5 p-3">
                  <p className="mb-1 text-xs font-semibold text-canopy-green">Response from ownership</p>
                  <p className="text-sm text-canopy-text">{r.owner_response}</p>
                </div>
              ) : isOwner ? (
                replyingTo === r.id ? (
                  <div className="mt-3">
                    <textarea
                      value={replyText}
                      onChange={(e) => setReplyText(e.target.value)}
                      placeholder="Write a response to this review…"
                      rows={2}
                      className="mb-2 w-full rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
                    />
                    <div className="flex gap-2">
                      <button
                        onClick={() => submitReply(r.id)}
                        className="rounded-full bg-canopy-green px-3 py-1.5 text-xs font-semibold text-black"
                      >
                        Post response
                      </button>
                      <button
                        onClick={() => {
                          setReplyingTo(null);
                          setReplyText('');
                        }}
                        className="rounded-full border border-canopy-border px-3 py-1.5 text-xs"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    onClick={() => setReplyingTo(r.id)}
                    className="mt-2 text-xs text-canopy-green hover:underline"
                  >
                    Respond as owner
                  </button>
                )
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
