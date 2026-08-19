'use client';

import { useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

type SyncResult = { product: string; productType: string; variantCount: number; slug: string };

type RunState = 'idle' | 'running' | 'done' | 'error';

export default function AdminMerchClient() {
  const supabase = createClient();
  const [state, setState] = useState<RunState>('idle');
  const [results, setResults] = useState<SyncResult[]>([]);
  const [error, setError] = useState('');

  const runSync = async () => {
    setState('running');
    setError('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setState('error');
      setError('You need to be signed in as an admin to run this.');
      return;
    }
    try {
      const res = await fetch('/api/admin/printful-sync', {
        method: 'POST',
        headers: { authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (!res.ok) {
        setState('error');
        setError(data.error || `Sync failed (${res.status}).`);
        return;
      }
      setResults(data.synced || []);
      setState('done');
    } catch (err) {
      setState('error');
      setError('Network error — try again.');
    }
  };

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-groovy text-3xl text-gradient-trippy">Merch — Printful Sync</h1>
        <div className="flex gap-3 text-xs">
          <Link href="/admin/strains" className="text-canopy-green hover:underline">
            Strain Review →
          </Link>
          <Link href="/admin/photos" className="text-canopy-green hover:underline">
            Photo Review →
          </Link>
          <Link href="/admin/learn" className="text-canopy-green hover:underline">
            Learn Review →
          </Link>
        </div>
      </div>
      <p className="mb-6 text-sm text-canopy-muted">
        Pulls every published product from your Printful store into Canopy's merch catalog —
        name, thumbnail, variants, sizes, colors, and prices. Safe to re-run any time you add a
        product or change pricing in Printful; it updates existing rows instead of duplicating
        them.
      </p>

      <button
        onClick={runSync}
        disabled={state === 'running'}
        className="btn-glow rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-6 py-3 text-sm font-semibold text-black disabled:opacity-50"
      >
        {state === 'running' ? 'Syncing…' : 'Sync from Printful'}
      </button>

      {state === 'error' && (
        <div className="mt-6 rounded-xl border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-300">
          {error}
        </div>
      )}

      {state === 'done' && (
        <div className="mt-6">
          <div className="mb-3 rounded-xl border border-canopy-green/40 bg-canopy-green/10 px-4 py-3 text-sm text-canopy-green">
            Synced {results.length} product{results.length === 1 ? '' : 's'}.
          </div>
          {results.length > 0 && (
            <div className="overflow-hidden rounded-2xl border border-canopy-border">
              <table className="w-full text-left text-sm">
                <thead className="bg-canopy-card text-xs uppercase text-canopy-muted">
                  <tr>
                    <th className="px-4 py-2">Product</th>
                    <th className="px-4 py-2">Type</th>
                    <th className="px-4 py-2">Variants</th>
                    <th className="px-4 py-2">Page</th>
                  </tr>
                </thead>
                <tbody>
                  {results.map((r) => (
                    <tr key={r.slug} className="border-t border-canopy-border">
                      <td className="px-4 py-2">{r.product}</td>
                      <td className="px-4 py-2 text-canopy-muted">{r.productType}</td>
                      <td className="px-4 py-2 text-canopy-muted">{r.variantCount}</td>
                      <td className="px-4 py-2">
                        <Link href={`/merch/${r.slug}`} target="_blank" className="text-canopy-green hover:underline">
                          View →
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
