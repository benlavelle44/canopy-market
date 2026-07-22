'use client';

import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

async function claimReferral(supabase: ReturnType<typeof createClient>, code: string) {
  try {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return;
    await fetch('/api/referral/claim', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ code }),
    });
    localStorage.removeItem('canopy_pending_ref');
  } catch {
    // best-effort; not worth blocking signup over
  }
}

function SignupInner() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const ref = params.get('ref');
    if (ref) localStorage.setItem('canopy_pending_ref', ref);
  }, [params]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { name } },
    });
    setLoading(false);

    if (error) {
      setError(error.message);
      return;
    }

    if (data.session) {
      const pendingRef = localStorage.getItem('canopy_pending_ref');
      if (pendingRef) await claimReferral(supabase, pendingRef);
      router.push('/');
      router.refresh();
    } else {
      setDone(true);
    }
  };

  if (done) {
    return (
      <div className="mx-auto max-w-sm px-4 py-20 text-center">
        <h1 className="mb-2 text-2xl font-bold">Check your email</h1>
        <p className="text-canopy-muted">We sent a confirmation link to {email}.</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-bold">Create your account</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          placeholder="Full name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
        />
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password (6+ characters)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-full bg-canopy-green px-6 py-3 font-semibold text-black hover:bg-canopy-greendark disabled:opacity-50"
        >
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-canopy-muted">
        Already have an account?{' '}
        <Link href="/login" className="text-canopy-green hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}

export default function SignupPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-sm px-4 py-16 text-center text-canopy-muted">Loading…</div>}>
      <SignupInner />
    </Suspense>
  );
}
