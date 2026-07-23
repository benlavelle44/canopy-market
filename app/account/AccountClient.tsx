'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { Profile, Strain, Review, Dispensary } from '@/lib/types';
import StrainCard from '@/components/StrainCard';

// The consolidated customer dashboard -- everything a shopper (not a
// dispensary owner) needs about their own account lives here: profile,
// tier/points, favorites, review history, referral link, and area sharing.
// Previously split across /account, /favorites, and pieces of /community;
// merged per Ben's call to have ONE nav destination for "your stuff" instead
// of three. The public /community leaderboard stays separate since it's
// about the whole platform, not just you -- this page links out to it.

type MyReview = Review & { strains: { name: string; slug: string } | null };

function AccountInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [favorites, setFavorites] = useState<Strain[]>([]);
  const [reviews, setReviews] = useState<MyReview[]>([]);
  const [myDispensaries, setMyDispensaries] = useState<Dispensary[]>([]);
  const [notice, setNotice] = useState('');
  const [copied, setCopied] = useState(false);
  const [city, setCity] = useState('');
  const [stateVal, setStateVal] = useState('');
  const [savingLocation, setSavingLocation] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (!user) {
        router.push('/login');
        return;
      }
      setUserId(user.id);

      const [{ data: profileRow }, { data: favRows }, { data: reviewRows }, { data: dispRows }] = await Promise.all([
        supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
        supabase.from('favorites').select('strains(*)').eq('user_id', user.id),
        supabase
          .from('reviews')
          .select('*, strains(name, slug)')
          .eq('user_id', user.id)
          .order('created_at', { ascending: false }),
        supabase.from('dispensaries').select('*').eq('owner_id', user.id),
      ]);

      setProfile((profileRow as Profile) || null);
      setCity((profileRow as Profile)?.city || '');
      setStateVal((profileRow as Profile)?.state || '');
      setFavorites(((favRows || []).map((r: any) => r.strains).filter(Boolean)) as Strain[]);
      setReviews((reviewRows || []) as MyReview[]);
      setMyDispensaries((dispRows || []) as Dispensary[]);
      setLoading(false);

      if (params.get('upgraded')) {
        setNotice('Welcome to Canopy+! It may take a minute for your badge to show up.');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const upgrade = async () => {
    if (!userId || !profile) return;
    const res = await fetch('/api/stripe/member-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, email: profile.email }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setNotice(data.error || 'Canopy+ isn’t available yet.');
    }
  };

  const referralLink =
    typeof window !== 'undefined' && profile?.referral_code
      ? `${window.location.origin}/signup?ref=${profile.referral_code}`
      : '';

  const copyLink = () => {
    if (!referralLink) return;
    navigator.clipboard.writeText(referralLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const saveLocation = async () => {
    if (!userId) return;
    setSavingLocation(true);
    await supabase.from('profiles').update({ city: city || null, state: stateVal || null }).eq('id', userId);
    setSavingLocation(false);
    setNotice('Location saved. Thanks for helping dispensaries stock what your area actually wants.');
    setTimeout(() => setNotice(''), 3000);
  };

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-canopy-muted">Loading…</div>;
  }

  const navItems = [
    { href: '#overview', label: 'Overview' },
    { href: '#favorites', label: `Favorites (${favorites.length})` },
    { href: '#reviews', label: `Reviews (${reviews.length})` },
    { href: '#referral', label: 'Referral & Community' },
    { href: '#settings', label: 'Settings' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-groovy text-3xl text-gradient-trippy">Your Dashboard</h1>
        {myDispensaries.length > 0 && (
          <Link
            href="/dashboard"
            className="rounded-full border border-canopy-border px-4 py-2 text-sm font-medium hover:border-canopy-green"
          >
            🏪 Manage Your Dispensary →
          </Link>
        )}
      </div>

      <nav className="mb-8 flex flex-wrap gap-2 border-b border-canopy-border pb-4 text-sm">
        {navItems.map((n) => (
          <a
            key={n.href}
            href={n.href}
            className="rounded-full border border-canopy-border px-3 py-1.5 text-canopy-muted hover:border-canopy-green hover:text-canopy-text"
          >
            {n.label}
          </a>
        ))}
      </nav>

      {notice && (
        <div className="mb-6 rounded-xl border border-canopy-green/40 bg-canopy-green/10 px-4 py-3 text-sm text-canopy-green">
          {notice}
        </div>
      )}

      {/* Overview */}
      <section id="overview" className="mb-10 scroll-mt-20">
        <div className="grid gap-4 sm:grid-cols-4">
          <div className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
            <p className="mb-1 text-xs uppercase text-canopy-muted">Name</p>
            <p className="font-medium">{profile?.name || '—'}</p>
            {profile?.member_tier === 'plus' && (
              <span className="mt-2 inline-block rounded-full border border-canopy-green/40 bg-canopy-green/10 px-2.5 py-0.5 text-[11px] font-medium text-canopy-green">
                Canopy+ Member
              </span>
            )}
          </div>
          <div className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
            <p className="mb-1 text-xs uppercase text-canopy-muted">Points</p>
            <p className="text-lg font-semibold text-canopy-gold">{profile?.points ?? 0} pts</p>
          </div>
          <div className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
            <p className="mb-1 text-xs uppercase text-canopy-muted">Favorites</p>
            <p className="text-lg font-semibold">{favorites.length}</p>
          </div>
          <div className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
            <p className="mb-1 text-xs uppercase text-canopy-muted">Reviews written</p>
            <p className="text-lg font-semibold">{reviews.length}</p>
          </div>
        </div>

        {profile?.member_tier !== 'plus' && (
          <div className="mt-4 rounded-2xl border border-canopy-green/40 bg-canopy-card p-5">
            <p className="mb-1 font-semibold">Join Canopy+ — $5/mo</p>
            <p className="mb-3 text-sm text-canopy-muted">
              Unlimited saved favorites, personalized recommendations, a verified reviewer badge, and
              +10 points to start.
            </p>
            <button
              onClick={upgrade}
              className="btn-glow rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-5 py-2.5 text-sm font-semibold text-black"
            >
              Upgrade to Canopy+
            </button>
          </div>
        )}
      </section>

      {/* Favorites */}
      <section id="favorites" className="mb-10 scroll-mt-20">
        <h2 className="mb-4 text-xl font-semibold">Your Favorites</h2>
        {favorites.length === 0 ? (
          <p className="text-sm text-canopy-muted">
            You haven't saved any strains yet.{' '}
            <Link href="/strains" className="text-canopy-green hover:underline">
              Browse strains →
            </Link>
          </p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {favorites.map((s) => (
              <StrainCard key={s.id} strain={s} />
            ))}
          </div>
        )}
      </section>

      {/* Reviews */}
      <section id="reviews" className="mb-10 scroll-mt-20">
        <h2 className="mb-4 text-xl font-semibold">Your Reviews</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-canopy-muted">
            You haven't reviewed any strains yet — reviews earn +5 points each.
          </p>
        ) : (
          <div className="space-y-3">
            {reviews.map((r) => (
              <div key={r.id} className="rounded-xl border border-canopy-border bg-canopy-card p-4">
                <div className="mb-1 flex items-center justify-between">
                  {r.strains ? (
                    <Link href={`/strains/${r.strains.slug}`} className="font-medium hover:text-canopy-green">
                      {r.strains.name}
                    </Link>
                  ) : (
                    <span className="font-medium">Strain removed</span>
                  )}
                  <span className="text-xs text-canopy-muted">
                    {new Date(r.created_at).toLocaleDateString()}
                  </span>
                </div>
                <div className="mb-1 text-canopy-gold">
                  {'★'.repeat(r.rating)}
                  {'☆'.repeat(5 - r.rating)}
                </div>
                {r.body && <p className="text-sm text-canopy-muted">{r.body}</p>}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Referral & Community */}
      <section id="referral" className="mb-10 scroll-mt-20">
        <h2 className="mb-4 text-xl font-semibold">Referral &amp; Community</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
            <p className="mb-1 font-semibold">Refer friends, earn points</p>
            <p className="mb-3 text-sm text-canopy-muted">
              Share your link. When someone signs up with it, you get +20 points.
            </p>
            <div className="flex gap-2">
              <input
                readOnly
                value={referralLink}
                className="flex-1 truncate rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-xs"
              />
              <button
                onClick={copyLink}
                className="whitespace-nowrap rounded-xl border border-canopy-border px-3 py-2 text-xs font-medium hover:border-canopy-green"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
            </div>
          </div>
          <div className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
            <p className="mb-1 font-semibold">See where you rank</p>
            <p className="mb-3 text-sm text-canopy-muted">
              Points, review counts, and referrals all feed the community leaderboard.
            </p>
            <Link
              href="/community"
              className="inline-block rounded-full border border-canopy-border px-4 py-2 text-xs font-medium hover:border-canopy-green"
            >
              View leaderboard →
            </Link>
          </div>
        </div>
      </section>

      {/* Settings */}
      <section id="settings" className="mb-6 scroll-mt-20">
        <h2 className="mb-4 text-xl font-semibold">Settings</h2>
        <div className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
          <p className="mb-1 font-semibold">Your area (optional)</p>
          <p className="mb-3 text-sm text-canopy-muted">
            Share your city/state and your anonymous favorites & ratings help us tell local
            dispensaries what strains and products their community actually wants. Never shared
            individually — only combined with other members' data.
          </p>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:max-w-sm">
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
            />
            <input
              value={stateVal}
              onChange={(e) => setStateVal(e.target.value)}
              placeholder="State (e.g. MT)"
              className="rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
            />
          </div>
          <button
            onClick={saveLocation}
            disabled={savingLocation}
            className="rounded-full border border-canopy-green/40 px-4 py-2 text-xs font-semibold text-canopy-green hover:bg-canopy-green/10 disabled:opacity-50"
          >
            {savingLocation ? 'Saving…' : 'Save location'}
          </button>
          <p className="mt-4 text-xs text-canopy-muted">
            Email: {profile?.email}
          </p>
        </div>
      </section>
    </div>
  );
}

export default function AccountClient() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-20 text-center text-canopy-muted">Loading…</div>}>
      <AccountInner />
    </Suspense>
  );
}
