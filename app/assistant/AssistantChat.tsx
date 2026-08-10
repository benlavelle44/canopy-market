'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';

interface Availability {
  name: string;
  slug: string;
  price: number | null;
  city: string;
  state: string;
}

// One shape for any kind of pick (strain / concentrate / edible) -- the
// server pre-formats the subtitle and href for each type so the client
// doesn't need three separate card layouts or type-specific field lookups.
interface Pick {
  type: 'strain' | 'concentrate' | 'edible';
  slug: string;
  name: string;
  subtitle: string;
  reason: string;
  href: string;
  availability: Availability[];
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  mode?: 'clarify' | 'recommend';
  picks?: Pick[];
  poweredBy?: 'ai' | 'heuristic';
  personalized?: boolean;
  creditsExhausted?: boolean;
  anonymousTasteUsed?: boolean;
}

const TYPE_LABEL: Record<Pick['type'], string> = {
  strain: 'Flower',
  concentrate: 'Concentrate',
  edible: 'Edible / Tincture / Topical',
};

const SUGGESTIONS = [
  'Something to help me sleep',
  'Low-key energy for a productive day',
  'Relief from stress after work, nothing too strong',
  'High CBD, low THC for daily wellness',
];

export default function AssistantChat() {
  const supabase = createClient();
  const params = useSearchParams();
  const initialQuery = params.get('q') || '';
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hey, I'm Kief 🦉 -- Canopy's AI budtender. Tell me how you want to feel, or a symptom you're hoping to ease, and I'll pull real matches from our catalog.",
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const firedInitial = useRef(false);

  const send = async (text: string) => {
    if (!text.trim() || loading) return;
    const userMsg: Message = { id: crypto.randomUUID(), role: 'user', content: text };
    setMessages((prev) => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    try {
      const history = messages.map((m) => ({ role: m.role, content: m.content }));
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(token ? { authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ message: text, history }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: data.reply,
          mode: data.mode,
          picks: data.picks,
          poweredBy: data.poweredBy,
          personalized: data.personalized,
          creditsExhausted: data.creditsExhausted,
          anonymousTasteUsed: data.anonymousTasteUsed,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: 'assistant',
          content: "Sorry, I hit an error finding a match. Please try again in a moment.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (initialQuery && !firedInitial.current) {
      firedInitial.current = true;
      send(initialQuery);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialQuery]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  return (
    <div className="flex flex-col rounded-2xl border border-canopy-border bg-canopy-panel">
      <div className="flex max-h-[60vh] min-h-[40vh] flex-col gap-4 overflow-y-auto p-5">
        {messages.map((m) => (
          <div key={m.id} className={m.role === 'user' ? 'flex justify-end' : 'flex justify-start'}>
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm ${
                m.role === 'user'
                  ? 'bg-canopy-green text-black'
                  : 'bg-canopy-card text-canopy-text'
              }`}
            >
              <p className="whitespace-pre-wrap">{m.content}</p>
              {m.personalized && (
                <p className="mt-1 text-[11px] text-canopy-green">✨ Tuned to your past ratings</p>
              )}
              {m.creditsExhausted && (
                <div className="mt-2 rounded-lg border border-canopy-gold/30 bg-canopy-gold/10 px-3 py-2 text-xs text-canopy-gold">
                  You're out of free chats with Kief this month -- these are quick-match results
                  instead.{' '}
                  <Link href="/pricing" className="underline hover:text-canopy-lime">
                    Buy more chats or go unlimited with Kief's Insight
                  </Link>
                  .
                </div>
              )}
              {m.anonymousTasteUsed && (
                <div className="mt-2 rounded-lg border border-canopy-purple/30 bg-canopy-purple/10 px-3 py-2 text-xs text-canopy-purple">
                  🦉 That was your free taste of Kief -- these are quick-match results instead.{' '}
                  <Link href="/signup" className="underline hover:text-canopy-lime">
                    Sign up free
                  </Link>{' '}
                  for 5 more chats a month, or unlock{' '}
                  <Link href="/pricing" className="underline hover:text-canopy-lime">
                    Kief's Insight
                  </Link>{' '}
                  for unlimited.
                </div>
              )}

              {m.picks && m.picks.length > 0 && (
                <div className="mt-3 space-y-2">
                  {m.picks.map((p) => (
                    <div key={`${p.type}:${p.slug}`} className="rounded-xl border border-canopy-border bg-canopy-bg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={p.href} className="font-semibold hover:text-canopy-green">
                          {p.name}
                        </Link>
                        <span className="rounded-full border border-canopy-border px-2 py-0.5 text-[10px] uppercase tracking-wide text-canopy-muted">
                          {TYPE_LABEL[p.type]}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-canopy-muted">{p.subtitle}</p>
                      {p.reason && <p className="mt-1 text-[11px] italic text-canopy-green">→ {p.reason}</p>}
                      {p.availability.length > 0 ? (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {p.availability.slice(0, 3).map((a) => (
                            <Link
                              key={a.slug}
                              href={`/dispensaries/${a.slug}`}
                              className="rounded-full border border-canopy-border px-2 py-0.5 text-[11px] text-canopy-muted hover:border-canopy-green hover:text-canopy-green"
                            >
                              {a.name} ({a.city}, {a.state}){a.price ? ` · $${a.price}` : ''}
                            </Link>
                          ))}
                        </div>
                      ) : (
                        <p className="mt-1.5 text-[11px] text-canopy-muted">
                          Not currently in stock at a dispensary in your state.
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="rounded-2xl bg-canopy-card px-4 py-3 text-sm text-canopy-muted">
              Thinking…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {messages.length <= 1 && (
        <div className="flex flex-wrap gap-2 border-t border-canopy-border px-5 py-3">
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onClick={() => send(s)}
              className="rounded-full border border-canopy-border px-3 py-1.5 text-xs text-canopy-muted hover:border-canopy-green hover:text-canopy-green"
            >
              {s}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(input);
        }}
        className="flex gap-2 border-t border-canopy-border p-4"
      >
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Describe how you want to feel…"
          className="flex-1 rounded-full border border-canopy-border bg-canopy-bg px-4 py-2.5 text-sm focus:border-canopy-green focus:outline-none"
        />
        <button
          disabled={loading}
          className="rounded-full bg-canopy-green px-5 py-2.5 text-sm font-semibold text-black hover:bg-canopy-greendark disabled:opacity-50"
        >
          Send
        </button>
      </form>
    </div>
  );
}
