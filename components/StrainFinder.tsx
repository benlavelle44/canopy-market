'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import TypeBadge from '@/components/TypeBadge';
import AiEstimateDisclaimer, { DisclaimerSource } from '@/components/AiEstimateDisclaimer';
import { StrainType } from '@/lib/types';

interface Candidate {
  name: string;
  type: StrainType;
  thc: number;
  cbd: number;
  description: string;
  effects: string[];
  symptoms: string[];
  terpenes: { name: string; percentage: number }[];
}

type Phase = 'idle' | 'checking-auth' | 'ready' | 'signed-out' | 'researching' | 'found' | 'not-found' | 'already-exists' | 'saving' | 'saved' | 'error';

export default function StrainFinder({
  query,
  suggestions,
}: {
  query: string;
  suggestions: { slug: string; name: string }[];
}) {
  const supabase = createClient();
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>('checking-auth');
  const [signedIn, setSignedIn] = useState(false);
  const [candidate, setCandidate] = useState<Candidate | null>(null);
  const [sources, setSources] = useState<DisclaimerSource[]>([]);
  const [message, setMessage] = useState('');
  const [matchedSlug, setMatchedSlug] = useState<{ slug: string; name: string } | null>(null);
  const [savedSlug, setSavedSlug] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSignedIn(!!data.session);
      setPhase('ready');
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runResearch = async () => {
    setPhase('researching');
    setMessage('');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setPhase('signed-out');
      return;
    }
    try {
      const res = await fetch('/api/strains/research', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ query }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Something went wrong.');
        setPhase('error');
        return;
      }
      if (data.alreadyExists) {
        setMatchedSlug(data.match);
        setPhase('already-exists');
        return;
      }
      if (!data.found) {
        setMessage(data.reason || "Couldn't confidently identify that strain.");
        setPhase('not-found');
        return;
      }
      setCandidate(data.candidate);
      setSources(data.sources || []);
      setPhase('found');
    } catch (e) {
      setMessage('Something went wrong reaching the strain finder.');
      setPhase('error');
    }
  };

  const confirmSave = async () => {
    if (!candidate) return;
    setPhase('saving');
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) {
      setPhase('signed-out');
      return;
    }
    try {
      const res = await fetch('/api/strains/confirm', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ candidate, sources }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage(data.error || 'Could not save that strain.');
        setPhase('error');
        return;
      }
      setSavedSlug(data.slug);
      setPhase('saved');
      setTimeout(() => router.push(`/strains/${data.slug}`), 1800);
    } catch (e) {
      setMessage('Something went wrong saving that strain.');
      setPhase('error');
    }
  };

  const reset = () => {
    setCandidate(null);
    setSources([]);
    setMessage('');
    setMatchedSlug(null);
    setPhase('ready');
  };

  return (
    <div className="mt-8 space-y-4">
      {suggestions.length > 0 && (
        <div className="rounded-2xl border border-canopy-green/30 bg-canopy-green/5 p-5">
          <p className="mb-2.5 text-sm font-medium text-canopy-text">Did you mean one of these?</p>
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => (
              <Link
                key={s.slug}
                href={`/strains/${s.slug}`}
                className="rounded-full border border-canopy-green/40 bg-canopy-card px-3 py-1.5 text-sm font-medium text-canopy-green hover:bg-canopy-green/20"
              >
                {s.name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {!query ? null : (
        <div className="card-glow-hover overflow-hidden rounded-3xl border border-canopy-purple/40 bg-gradient-to-br from-canopy-purple/10 via-canopy-bg to-canopy-green/5 p-6 shadow-glowsm">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <span className="text-2xl">🔮</span>
            <h3 className="text-base font-semibold text-canopy-text">AI Strain Finder</h3>
            <span className="rounded-full border border-canopy-purple/40 bg-canopy-purple/10 px-2.5 py-0.5 text-[10px] font-medium text-canopy-purple">
              Community-Powered
            </span>
          </div>

          {phase === 'checking-auth' && <p className="text-sm text-canopy-muted">Loading…</p>}

          {phase === 'ready' && !signedIn && (
            <p className="text-sm text-canopy-muted">
              Not in our database yet.{' '}
              <Link href="/login" className="text-canopy-green hover:underline">
                Sign in
              </Link>{' '}
              to search the web for "{query}" and help build the catalog.
            </p>
          )}

          {phase === 'ready' && signedIn && (
            <div>
              <p className="mb-3 text-sm text-canopy-muted">
                "{query}" isn't in our database yet. Search the web for it? We'll verify it's not just a typo, show
                you what we find, and only save it once you confirm it's right.
              </p>
              <button
                onClick={runResearch}
                className="btn-glow rounded-full bg-gradient-to-r from-canopy-purple to-canopy-green px-5 py-2.5 text-sm font-semibold text-black"
              >
                🔍 Search the web for "{query}"
              </button>
            </div>
          )}

          {phase === 'signed-out' && (
            <p className="text-sm text-canopy-muted">
              Your session expired.{' '}
              <Link href="/login" className="text-canopy-green hover:underline">
                Sign in
              </Link>{' '}
              again to keep going.
            </p>
          )}

          {phase === 'researching' && (
            <p className="text-sm text-canopy-muted">Researching "{query}" across the web…</p>
          )}

          {phase === 'already-exists' && matchedSlug && (
            <p className="text-sm text-canopy-text">
              This looks like it might already be{' '}
              <Link href={`/strains/${matchedSlug.slug}`} className="text-canopy-green hover:underline">
                {matchedSlug.name}
              </Link>
              . Take a look, or{' '}
              <button onClick={reset} className="text-canopy-green hover:underline">
                try a different search
              </button>
              .
            </p>
          )}

          {phase === 'not-found' && (
            <div>
              <p className="mb-2 text-sm text-canopy-text">{message}</p>
              <button onClick={reset} className="text-sm text-canopy-green hover:underline">
                Try a different spelling
              </button>
            </div>
          )}

          {phase === 'error' && (
            <div>
              <p className="mb-2 text-sm text-red-300">{message}</p>
              <button onClick={reset} className="text-sm text-canopy-green hover:underline">
                Try again
              </button>
            </div>
          )}

          {(phase === 'found' || phase === 'saving') && candidate && (
            <div>
              <p className="mb-3 text-sm text-canopy-text">Is this it?</p>
              <div className="mb-3 rounded-xl border border-canopy-border bg-canopy-card p-4">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <span className="font-semibold">{candidate.name}</span>
                  <TypeBadge type={candidate.type} />
                  <span className="text-xs text-canopy-muted">
                    THC ~{candidate.thc}% · CBD ~{candidate.cbd}%*
                  </span>
                </div>
                <p className="mb-3 text-sm text-canopy-muted">{candidate.description}</p>
                <div className="mb-3 flex flex-wrap gap-1.5">
                  {candidate.effects.map((e) => (
                    <span key={e} className="rounded-full bg-canopy-bg px-2.5 py-1 text-xs">
                      {e}
                    </span>
                  ))}
                  {candidate.symptoms.map((s) => (
                    <span key={s} className="rounded-full bg-canopy-bg px-2.5 py-1 text-xs text-canopy-muted">
                      {s}
                    </span>
                  ))}
                </div>
                {/* Disclaimer stays at the bottom of the preview, right above the confirm buttons */}
                <AiEstimateDisclaimer sources={sources} compact />
              </div>
              <div className="flex gap-2">
                <button
                  onClick={confirmSave}
                  disabled={phase === 'saving'}
                  className="rounded-full bg-canopy-green px-4 py-2 text-xs font-semibold text-black disabled:opacity-50"
                >
                  {phase === 'saving' ? 'Saving…' : "Yes, that's it — add it"}
                </button>
                <button
                  onClick={reset}
                  disabled={phase === 'saving'}
                  className="rounded-full border border-canopy-border px-4 py-2 text-xs font-medium hover:border-canopy-green disabled:opacity-50"
                >
                  No, that's not right
                </button>
              </div>
            </div>
          )}

          {phase === 'saved' && savedSlug && (
            <p className="text-sm text-canopy-green">
              Added! It's pending review, and you'll get credit as its finder once it's verified. Taking you there
              now…
            </p>
          )}
        </div>
      )}
    </div>
  );
}
