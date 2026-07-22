'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function LoginPage() {
  const supabase = createClient();
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    const pendingRef = typeof window !== 'undefined' ? localStorage.getItem('canopy_pending_ref') : null;
    if (pendingRef) {
      try {
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData.session?.access_token;
        if (token) {
          await fetch('/api/referral/claim', {
            method: 'POST',
            headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
            body: JSON.stringify({ code: pendingRef }),
          });
        }
        localStorage.removeItem('canopy_pending_ref');
      } catch {
        // best-effort
      }
    }
    router.push('/');
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-sm px-4 py-16">
      <h1 className="mb-6 text-center text-2xl font-bold">Welcome back</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-xl border border-canopy-border bg-canopy-panel px-4 py-2.5 focus:border-canopy-green focus:outline-none"
        />
        {error && <p className="text-sm text-red-400">{error}</p>}
        <button
          disabled={loading}
          className="w-full rounded-full bg-canopy-green px-6 py-3 font-semibold text-black hover:bg-canopy-greendark disabled:opacity-50"
        >
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <p className="mt-4 text-center text-sm text-canopy-muted">
        No account?{' '}
        <Link href="/signup" className="text-canopy-green hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  );
}
