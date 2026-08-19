'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { StrainPhoto, GROW_STAGES } from '@/lib/types';

type PendingPhoto = StrainPhoto & {
  strains: { name: string; slug: string } | null;
  submitter: { name: string | null; email: string | null } | null;
};

type LoadState = 'loading' | 'unauthorized' | 'ready' | 'error';

const STAGE_LABEL: Record<string, string> = Object.fromEntries(GROW_STAGES.map((s) => [s.id, s.label]));

export default function AdminPhotosClient() {
  const supabase = createClient();
  const [state, setState] = useState<LoadState>('loading');
  const [photos, setPhotos] = useState<PendingPhoto[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setState('unauthorized');
      return;
    }
    const res = await fetch('/api/strains/photos/review', { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) {
      setState('unauthorized');
      return;
    }
    if (!res.ok) {
      setState('error');
      return;
    }
    const data = await res.json();
    setPhotos(data.photos || []);
    setState('ready');
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (photoId: string, action: 'approve' | 'reject') => {
    setBusyId(photoId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setState('unauthorized');
      return;
    }
    const res = await fetch('/api/strains/photos/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ photoId, action }),
    });
    const data = await res.json();
    if (res.ok) {
      setPhotos((prev) => prev.filter((p) => p.id !== photoId));
      setNotice(
        action === 'approve'
          ? `Verified — awarded ${data.awardedPoints} points to the submitter.`
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
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="font-groovy text-3xl text-gradient-trippy">Grow Photo Review Queue</h1>
        <div className="flex gap-3 text-xs">
          <Link href="/admin/strains" className="text-canopy-green hover:underline">
            Strain Review Queue →
          </Link>
          <Link href="/admin/merch" className="text-canopy-green hover:underline">
            Merch Sync →
          </Link>
          <Link href="/admin/learn" className="text-canopy-green hover:underline">
            Learn Review →
          </Link>
        </div>
      </div>
      <p className="mb-6 text-sm text-canopy-muted">
        Community-submitted grow photos waiting on verification before they appear on strain pages.
      </p>

      {notice && (
        <div className="mb-6 rounded-xl border border-canopy-green/40 bg-canopy-green/10 px-4 py-3 text-sm text-canopy-green">
          {notice}
        </div>
      )}

      {photos.length === 0 ? (
        <p className="text-canopy-muted">Nothing pending right now.</p>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2">
          {photos.map((p) => (
            <div key={p.id} className="overflow-hidden rounded-2xl border border-canopy-border bg-canopy-card">
              <div className="aspect-square">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image_url} alt={p.caption || 'Grow photo'} className="h-full w-full object-cover" />
              </div>
              <div className="p-4">
                <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
                  {p.strains && (
                    <Link href={`/strains/${p.strains.slug}`} target="_blank" className="font-semibold hover:text-canopy-green">
                      {p.strains.name}
                    </Link>
                  )}
                  <span className="rounded-full bg-canopy-bg px-2 py-0.5 text-[10px] text-canopy-muted">
                    {STAGE_LABEL[p.grow_stage] || p.grow_stage}
                  </span>
                </div>
                {p.caption && <p className="mb-1 text-sm text-canopy-muted">{p.caption}</p>}
                <p className="mb-3 text-xs text-canopy-muted">
                  Submitted by: {p.credit_name || p.submitter?.name || p.submitter?.email || 'Unknown member'}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => act(p.id, 'approve')}
                    disabled={busyId === p.id}
                    className="rounded-full bg-canopy-green px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                  >
                    {busyId === p.id ? '…' : 'Approve & Verify'}
                  </button>
                  <button
                    onClick={() => act(p.id, 'reject')}
                    disabled={busyId === p.id}
                    className="rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
