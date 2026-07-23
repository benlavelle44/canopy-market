'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import TypeBadge from '@/components/TypeBadge';
import AiEstimateDisclaimer from '@/components/AiEstimateDisclaimer';
import { Strain, ResearchSource } from '@/lib/types';

type PendingStrain = Strain & { finder: { name: string | null; email: string | null } | null };

type LoadState = 'loading' | 'unauthorized' | 'ready' | 'error';

export default function AdminStrainsClient() {
  const supabase = createClient();
  const [state, setState] = useState<LoadState>('loading');
  const [strains, setStrains] = useState<PendingStrain[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setState('unauthorized');
      return;
    }
    const res = await fetch('/api/strains/review', { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) {
      setState('unauthorized');
      return;
    }
    if (!res.ok) {
      setState('error');
      return;
    }
    const data = await res.json();
    setStrains(data.strains || []);
    setState('ready');
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (strainId: string, action: 'approve' | 'reject') => {
    setBusyId(strainId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setState('unauthorized');
      return;
    }
    const res = await fetch('/api/strains/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ strainId, action }),
    });
    const data = await res.json();
    if (res.ok) {
      setStrains((prev) => prev.filter((s) => s.id !== strainId));
      setNotice(
        action === 'approve'
          ? `Verified${data.awardedPoints ? ` — awarded ${data.awardedPoints} points to the finder.` : '.'}`
          : 'Rejected and removed.'
      );
      setTimeout(() => setNotice(''), 3000);
    } else {
      setNotice(data.error || 'Something went wrong.');
    }
    setBusyId(null);
  };

  if (state === 'loading') {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-canopy-muted">Loading…</div>;
  }
  if (state === 'unauthorized') {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-center text-canopy-muted">
        You need to be signed in as an admin to view this page.
      </div>
    );
  }
  if (state === 'error') {
    return <div className="mx-auto max-w-4xl px-4 py-20 text-center text-red-300">Couldn't load the review queue.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="mb-2 font-groovy text-3xl text-gradient-trippy">Strain Review Queue</h1>
      <p className="mb-6 text-sm text-canopy-muted">
        AI Strain Finder submissions waiting on verification before they appear in general browse/search.
      </p>

      {notice && (
        <div className="mb-6 rounded-xl border border-canopy-green/40 bg-canopy-green/10 px-4 py-3 text-sm text-canopy-green">
          {notice}
        </div>
      )}

      {strains.length === 0 ? (
        <p className="text-canopy-muted">Nothing pending right now.</p>
      ) : (
        <div className="space-y-5">
          {strains.map((s) => (
            <div key={s.id} className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <Link href={`/strains/${s.slug}`} target="_blank" className="font-semibold hover:text-canopy-green">
                    {s.name}
                  </Link>
                  <TypeBadge type={s.type} />
                  <span className="text-xs text-canopy-muted">
                    THC ~{s.thc}% · CBD ~{s.cbd}%
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(s.id, 'approve')}
                    disabled={busyId === s.id}
                    className="rounded-full bg-canopy-green px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    {busyId === s.id ? '…' : 'Approve & Verify'}
                  </button>
                  <button
                    onClick={() => act(s.id, 'reject')}
                    disabled={busyId === s.id}
                    className="rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>

              <p className="mb-2 text-sm text-canopy-muted">{s.description}</p>

              <div className="mb-3 flex flex-wrap gap-1.5">
                {s.effects.map((e) => (
                  <span key={e} className="rounded-full bg-canopy-bg px-2.5 py-1 text-xs">
                    {e}
                  </span>
                ))}
                {s.symptoms.map((sym) => (
                  <span key={sym} className="rounded-full bg-canopy-bg px-2.5 py-1 text-xs text-canopy-muted">
                    {sym}
                  </span>
                ))}
              </div>

              <p className="mb-3 text-xs text-canopy-muted">
                Found by: {s.finder?.name || s.finder?.email || 'Unknown member'}
              </p>

              <AiEstimateDisclaimer sources={(s.research_sources || []) as ResearchSource[]} compact />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
