'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

function slugify(name: string) {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

const US_STATES = [
  'AL','AK','AZ','AR','CA','CO','CT','DE','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD',
  'MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC',
  'SD','TN','TX','UT','VT','VA','WA','WV','WI','WY',
];

export default function DispensarySignupPage() {
  const supabase = createClient();
  const [checkingAuth, setCheckingAuth] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: '',
    description: '',
    address: '',
    city: '',
    state: 'CA',
    zip: '',
    phone: '',
    website_url: '',
    license_number: '',
    owner_email: '',
  });

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const user = data.session?.user;
      setUserId(user?.id ?? null);
      if (user?.email) update('owner_email', user.email);
      setCheckingAuth(false);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const update = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!userId) {
      setError('Please sign in first.');
      return;
    }

    if (!form.name || !form.city || !form.state || !form.license_number || !form.owner_email) {
      setError('Please fill in dispensary name, city, state, license number, and your email.');
      return;
    }

    setLoading(true);
    const slugBase = slugify(form.name);
    const slug = `${slugBase}-${Math.random().toString(36).slice(2, 6)}`;

    const { error: insertError } = await supabase.from('dispensaries').insert({
      slug,
      name: form.name,
      description: form.description || null,
      address: form.address || null,
      city: form.city,
      state: form.state,
      zip: form.zip || null,
      phone: form.phone || null,
      website_url: form.website_url || null,
      license_number: form.license_number,
      owner_email: form.owner_email,
      owner_id: userId,
      hours: {},
      status: 'pending',
    });

    setLoading(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setSubmitted(true);
  };

  if (checkingAuth) {
    return <div className="mx-auto max-w-md px-4 py-24 text-center text-canopy-muted">Loading…</div>;
  }

  if (!userId) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-canopy-green/30 to-canopy-purple/30 text-3xl">
          🌿
        </div>
        <h1 className="mb-2 font-groovy text-2xl text-gradient-trippy">Sign in to list your dispensary</h1>
        <p className="mb-6 text-canopy-muted">
          Creating an account lets you manage your storefront and menu later from your dashboard.
        </p>
        <div className="flex flex-col gap-2">
          <Link
            href="/signup"
            className="btn-glow rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-6 py-3 font-semibold text-black"
          >
            Create an account
          </Link>
          <Link
            href="/login"
            className="rounded-full border border-canopy-border px-6 py-3 font-semibold text-canopy-text hover:border-canopy-green"
          >
            I already have an account
          </Link>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="mx-auto max-w-lg px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-canopy-green/15 text-3xl">
          ✓
        </div>
        <h1 className="mb-2 text-2xl font-bold">You're on the map!</h1>
        <p className="mb-6 text-canopy-muted">
          Your storefront is live in our directory with a "Pending Verification" badge while our
          team confirms your license. Head to your dashboard to add your menu.
        </p>
        <Link href="/dashboard" className="text-canopy-green hover:underline">
          Go to your dashboard →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <h1 className="mb-2 text-3xl font-bold">List Your Dispensary</h1>
      <p className="mb-8 text-canopy-muted">
        Free storefront on Canopy Market. Customers using our AI budtender get matched directly to
        your listing when you carry a strain they're looking for.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm text-canopy-muted">Dispensary name *</label>
          <input
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm text-canopy-muted">Description</label>
          <textarea
            value={form.description}
            onChange={(e) => update('description', e.target.value)}
            rows={3}
            className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-canopy-muted">Street address</label>
            <input
              value={form.address}
              onChange={(e) => update('address', e.target.value)}
              className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-canopy-muted">ZIP code</label>
            <input
              value={form.zip}
              onChange={(e) => update('zip', e.target.value)}
              className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-canopy-muted">City *</label>
            <input
              value={form.city}
              onChange={(e) => update('city', e.target.value)}
              className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-canopy-muted">State *</label>
            <select
              value={form.state}
              onChange={(e) => update('state', e.target.value)}
              className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
            >
              {US_STATES.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-canopy-muted">Phone</label>
            <input
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-canopy-muted">Your ordering site URL</label>
            <input
              value={form.website_url}
              onChange={(e) => update('website_url', e.target.value)}
              placeholder="https://"
              className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-sm text-canopy-muted">License number *</label>
            <input
              value={form.license_number}
              onChange={(e) => update('license_number', e.target.value)}
              className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm text-canopy-muted">Your email *</label>
            <input
              type="email"
              value={form.owner_email}
              onChange={(e) => update('owner_email', e.target.value)}
              className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
            />
          </div>
        </div>

        {error && <p className="text-sm text-red-400">{error}</p>}

        <button
          disabled={loading}
          className="btn-glow w-full rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-6 py-3 font-semibold text-black disabled:opacity-50"
        >
          {loading ? 'Submitting…' : 'Create My Storefront'}
        </button>
      </form>
    </div>
  );
}
