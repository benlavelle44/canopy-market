'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import { Profile } from '@/lib/types';

function AccountInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
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
      const { data: profileRow } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();
      setProfile((profileRow as Profile) || null);
      setCity((profileRow as Profile)?.city || '');
      setStateVal((profileRow as Profile)?.state || '');
      setLoading(false);
      if (params.get('upgraded')) {
        setNotice("Welcome to Canopy+! It may take a minute for your badge to show up.");
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
    return <div className="mx-auto max-w-md px-4 py-20 text-center text-canopy-muted">Loading…</div>;
  }

  return (
    <div className="mx-auto max-w-md px-4 py-16">
      <h1 className="mb-6 text-2xl font-bold">Your Account</h1>

      {notice && (
        <div className="mb-4 rounded-xl border border-canopy-green/40 bg-canopy-green/10 px-4 py-3 text-sm text-canopy-green">
          {notice}
        </div>
      )}

      <div className="space-y-4 rounded-2xl border border-canopy-border bg-canopy-card p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs uppercase text-canopy-muted">Name</p>
            <p>{profile?.name || '—'}</p>
          </div>
          {profile?.member_tier === 'plus' && (
            <span className="rounded-full border border-canopy-green/40 bg-canopy-green/10 px-2.5 py-0.5 text-[11px] font-medium text-canopy-green">
              Canopy+ Member
            </span>
          )}
        </div>
        <div>
          <p className="text-xs uppercase text-canopy-muted">Email</p>
          <p>{profile?.email}</p>
        </div>
        <div>
          <p className="text-xs uppercase text-canopy-muted">Community points</p>
          <p className="text-lg font-semibold text-canopy-gold">{profile?.points ?? 0} pts</p>
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

      <div className="mt-4 rounded-2xl border border-canopy-border bg-canopy-card p-5">
        <p className="mb-1 font-semibold">Your area (optional)</p>
        <p className="mb-3 text-sm text-canopy-muted">
          Share your city/state and your anonymous favorites & ratings help us tell local
          dispensaries what strains and products their community actually wants. Never shared
          individually — only combined with other members' data.
        </p>
        <div className="mb-3 grid grid-cols-2 gap-2">
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
      </div>

      <div className="mt-4 rounded-2xl border border-canopy-border bg-canopy-card p-5">
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
    </div>
  );
}

export default function AccountPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-md px-4 py-20 text-center text-canopy-muted">Loading…</div>}>
      <AccountInner />
    </Suspense>
  );
}
