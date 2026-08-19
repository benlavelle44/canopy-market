'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { LearnArticle, LearnBlock, LEARN_CATEGORY_LABELS } from '@/lib/types';

type LoadState = 'loading' | 'unauthorized' | 'ready' | 'error';

function BlockPreview({ block }: { block: LearnBlock }) {
  if (block.type === 'h2') return <p className="mt-2 font-semibold text-canopy-text">{block.text}</p>;
  if (block.type === 'list')
    return (
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-canopy-muted">
        {block.items.map((i, idx) => (
          <li key={idx}>{i}</li>
        ))}
      </ul>
    );
  if (block.type === 'term')
    return (
      <p className="mt-1 text-canopy-muted">
        <span className="text-canopy-text">{block.term}</span> — {block.definition}
      </p>
    );
  return <p className="mt-1 text-canopy-muted">{block.text}</p>;
}

export default function AdminLearnClient() {
  const supabase = createClient();
  const [state, setState] = useState<LoadState>('loading');
  const [drafts, setDrafts] = useState<LearnArticle[]>([]);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setState('unauthorized');
      return;
    }
    const res = await fetch('/api/admin/learn/review', { headers: { authorization: `Bearer ${token}` } });
    if (res.status === 401 || res.status === 403) {
      setState('unauthorized');
      return;
    }
    if (!res.ok) {
      setState('error');
      return;
    }
    const data = await res.json();
    setDrafts(data.drafts || []);
    setState('ready');
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const act = async (articleId: string, action: 'approve' | 'discard') => {
    setBusyId(articleId);
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setState('unauthorized');
      return;
    }
    const res = await fetch('/api/admin/learn/review', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ articleId, action }),
    });
    const data = await res.json();
    if (res.ok) {
      setDrafts((prev) => prev.filter((d) => d.id !== articleId));
      setNotice(action === 'approve' ? 'Published to /learn.' : 'Discarded.');
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
        <h1 className="font-groovy text-3xl text-gradient-trippy">Learn Article Review</h1>
        <div className="flex gap-3 text-xs">
          <Link href="/admin/strains" className="text-canopy-green hover:underline">
            Strain Review →
          </Link>
          <Link href="/admin/photos" className="text-canopy-green hover:underline">
            Photo Review →
          </Link>
          <Link href="/admin/merch" className="text-canopy-green hover:underline">
            Merch Sync →
          </Link>
        </div>
      </div>
      <p className="mb-6 text-sm text-canopy-muted">
        Drafts written by the scheduled Learn content task, waiting on approval before they go live
        on /learn. Nothing publishes automatically.
      </p>

      {notice && (
        <div className="mb-6 rounded-xl border border-canopy-green/40 bg-canopy-green/10 px-4 py-3 text-sm text-canopy-green">
          {notice}
        </div>
      )}

      {drafts.length === 0 ? (
        <p className="text-canopy-muted">No drafts waiting on review right now.</p>
      ) : (
        <div className="space-y-5">
          {drafts.map((d) => (
            <div key={d.id} className="rounded-2xl border border-canopy-border bg-canopy-card p-5">
              <div className="mb-2 flex flex-wrap items-center gap-2">
                <span className="rounded-full border border-canopy-purple/40 px-2 py-0.5 text-[10px] font-semibold text-canopy-purple">
                  {LEARN_CATEGORY_LABELS[d.category]}
                </span>
                <span className="text-xs text-canopy-muted">/{d.category}/{d.slug}</span>
              </div>
              <h2 className="mb-1 text-lg font-semibold">{d.title}</h2>
              <p className="mb-2 text-sm text-canopy-muted">{d.description}</p>
              <div className="mb-3 rounded-xl border border-canopy-green/30 bg-canopy-green/5 p-3 text-sm text-canopy-text">
                {d.kief_intro}
              </div>
              <details className="mb-4 text-sm">
                <summary className="cursor-pointer text-canopy-green">Preview full article</summary>
                <div className="mt-2 space-y-1">
                  {d.body.map((b, i) => (
                    <BlockPreview key={i} block={b} />
                  ))}
                </div>
              </details>
              <div className="flex gap-2">
                <button
                  onClick={() => act(d.id, 'approve')}
                  disabled={busyId === d.id}
                  className="rounded-full bg-canopy-green px-4 py-1.5 text-xs font-semibold text-black disabled:opacity-50"
                >
                  {busyId === d.id ? '…' : 'Approve & Publish'}
                </button>
                <button
                  onClick={() => act(d.id, 'discard')}
                  disabled={busyId === d.id}
                  className="rounded-full border border-red-500/40 px-4 py-1.5 text-xs font-medium text-red-300 hover:bg-red-500/10 disabled:opacity-50"
                >
                  Discard
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
