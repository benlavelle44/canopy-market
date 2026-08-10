'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

const DISPENSARY_TIERS = [
  {
    id: 'free',
    name: 'Free',
    price: '$0',
    period: 'forever',
    tagline: 'Get discovered, no cost.',
    features: [
      'Storefront listed in the directory',
      'Up to 10 menu items across any category (flower, edibles, dabs, etc.)',
      'Shown in AI budtender matches',
      'Basic business info & hours',
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    price: '$19',
    period: '/ month',
    tagline: 'For dispensaries that want to grow.',
    features: [
      'Everything in Free',
      'Unlimited menu items — flower, prerolls, dabs, vapes, edibles, tinctures, topicals, accessories',
      'Priority placement in search & AI results',
      'Storefront analytics (views, top searches)',
      'Featured badge',
    ],
    highlighted: true,
  },
  {
    id: 'verified',
    name: 'Verified',
    price: '$59',
    period: '/ month',
    tagline: 'Maximum trust and visibility.',
    features: [
      'Everything in Pro',
      'Local Demand Insights — see what strains/products your area actually wants (anonymized, aggregated)',
      'License-verified badge',
      'Top placement above Pro listings',
      'Homepage feature rotation',
      'Direct support line',
    ],
  },
];

export default function PricingPage() {
  const supabase = createClient();
  const [userId, setUserId] = useState<string | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [memberTier, setMemberTier] = useState<'free' | 'plus'>('free');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const user = data.session?.user;
      if (!user) return;
      setUserId(user.id);
      setEmail(user.email ?? null);
      const { data: profile } = await supabase.from('profiles').select('member_tier').eq('id', user.id).maybeSingle();
      setMemberTier((profile as any)?.member_tier === 'plus' ? 'plus' : 'free');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const joinCanopyPlus = async () => {
    if (!userId) {
      window.location.href = '/signup';
      return;
    }
    const res = await fetch('/api/stripe/member-checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ userId, email }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setNotice(data.error || 'Canopy+ isn’t available yet.');
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-14">
      <div className="mb-12 text-center">
        <h1 className="font-groovy text-4xl text-gradient-trippy">Pricing</h1>
        <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
          Two sides of one marketplace: customers who want a smarter, personalized experience, and
          dispensaries who want more visibility. Neither pays for the other.
        </p>
      </div>

      {/* Consumer tier */}
      <div className="mb-16">
        <h2 className="mb-6 text-center text-xl font-semibold">For customers</h2>
        <div className="mx-auto grid max-w-3xl gap-6 sm:grid-cols-2">
          <div className="rounded-3xl border border-canopy-border bg-canopy-card p-6">
            <h3 className="font-groovy text-xl">Free</h3>
            <p className="mt-1 text-sm text-canopy-muted">Browse, ask, and save.</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-canopy-text">$0</span>
            </div>
            <ul className="mt-6 space-y-2 text-sm text-canopy-muted">
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>Full strain & dispensary directory</span></li>
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>AI budtender chat -- fresh matches every time</span></li>
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>Up to 10 saved favorites</span></li>
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>Earn community points for reviews & referrals</span></li>
            </ul>
          </div>
          <div className="rounded-3xl border border-canopy-green bg-canopy-card p-6 shadow-glow">
            <h3 className="font-groovy text-xl">Canopy+</h3>
            <p className="mt-1 text-sm text-canopy-muted">For regulars who want it personalized.</p>
            <div className="mt-4 flex items-baseline gap-1">
              <span className="text-3xl font-bold text-canopy-text">$5</span>
              <span className="text-sm text-canopy-muted">/ month</span>
            </div>
            {/* Free already lists "AI budtender chat" as a feature, so burying
                the personalization upgrade as one bullet among five made
                Canopy+ look skippable. This callout leads with the actual
                headline reason to pay: a named, upgraded assistant, not a
                generic one. */}
            <div className="mt-4 rounded-xl border border-canopy-green/30 bg-canopy-green/10 px-3 py-2">
              <p className="text-sm font-semibold text-canopy-green">Unlocks the AI Personal Budtender</p>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-canopy-muted">
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>Remembers every strain you've rated</span></li>
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>Never re-suggests one you disliked</span></li>
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>Gets more tailored every time you chat</span></li>
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>Unlimited saved favorites (Free caps at 10)</span></li>
              <li className="flex items-start gap-2"><span className="text-canopy-green">✓</span><span>Canopy+ Member badge + 10 bonus points to start</span></li>
            </ul>
            {notice && <p className="mt-3 text-xs text-red-400">{notice}</p>}
            <button
              onClick={joinCanopyPlus}
              disabled={memberTier === 'plus'}
              className="btn-glow mt-8 w-full rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-4 py-2.5 text-center text-sm font-semibold text-black disabled:opacity-60"
            >
              {memberTier === 'plus' ? "You're a member" : userId ? 'Join Canopy+' : 'Sign up to join'}
            </button>
          </div>
        </div>
      </div>

      {/* Dispensary tiers */}
      <div>
        <h2 className="mb-1 text-center text-xl font-semibold">For dispensaries</h2>
        <p className="mx-auto mb-6 max-w-xl text-center text-sm text-canopy-muted">
          Launch pricing — lower than our original rates while we build up traffic in your area.
        </p>
        <div className="grid gap-6 md:grid-cols-3">
          {DISPENSARY_TIERS.map((tier) => (
            <div
              key={tier.id}
              className={`rounded-3xl border p-6 ${
                tier.highlighted
                  ? 'border-canopy-green bg-canopy-card shadow-glow'
                  : 'border-canopy-border bg-canopy-card'
              }`}
            >
              <h3 className="font-groovy text-xl">{tier.name}</h3>
              <p className="mt-1 text-sm text-canopy-muted">{tier.tagline}</p>
              <div className="mt-4 flex items-baseline gap-1">
                <span className="text-3xl font-bold text-canopy-text">{tier.price}</span>
                <span className="text-sm text-canopy-muted">{tier.period}</span>
              </div>
              <ul className="mt-6 space-y-2 text-sm text-canopy-muted">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2">
                    <span className="text-canopy-green">✓</span>
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
              <Link
                href={tier.id === 'free' ? '/dispensary-signup' : '/dashboard'}
                className={`mt-8 block rounded-full px-4 py-2.5 text-center text-sm font-semibold ${
                  tier.highlighted
                    ? 'btn-glow bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green text-black'
                    : 'border border-canopy-border text-canopy-text hover:border-canopy-green'
                }`}
              >
                {tier.id === 'free' ? 'List for Free' : `Upgrade to ${tier.name}`}
              </Link>
            </div>
          ))}
        </div>
      </div>

      <p className="mx-auto mt-10 max-w-2xl text-center text-xs text-canopy-muted">
        Canopy Market charges for software, visibility, and membership perks only — we never
        process cannabis payments. All product transactions happen directly with the dispensary
        through their own ordering system.
      </p>
    </div>
  );
}
