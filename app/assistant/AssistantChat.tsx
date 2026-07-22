'use client';

import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import Link from 'next/link';
import TypeBadge from '@/components/TypeBadge';
import { Strain } from '@/lib/types';

interface Availability {
  name: string;
  slug: string;
  price: number | null;
  city: string;
  state: string;
}

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  strains?: Strain[];
  availability?: Record<string, Availability[]>;
  poweredBy?: 'ai' | 'heuristic';
}

const SUGGESTIONS = [
  'Something to help me sleep',
  'Low-key energy for a productive day',
  'Relief from stress after work, nothing too strong',
  'High CBD, low THC for daily wellness',
];

export default function AssistantChat() {
  const params = useSearchParams();
  const initialQuery = params.get('q') || '';
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'welcome',
      role: 'assistant',
      content:
        "Hey! I'm your AI budtender. Tell me how you want to feel, or a symptom you're hoping to ease, and I'll pull real matches from our catalog.",
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
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
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
          strains: data.strains,
          availability: data.availability,
          poweredBy: data.poweredBy,
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

              {m.strains && m.strains.length > 0 && (
                <div className="mt-3 space-y-2">
                  {m.strains.map((s) => (
                    <div key={s.id} className="rounded-xl border border-canopy-border bg-canopy-bg p-3">
                      <div className="flex items-center justify-between gap-2">
                        <Link href={`/strains/${s.slug}`} className="font-semibold hover:text-canopy-green">
                          {s.name}
                        </Link>
                        <TypeBadge type={s.type} />
                      </div>
                      <p className="mt-1 text-xs text-canopy-muted">
                        THC {s.thc}% · CBD {s.cbd}% · {s.effects.slice(0, 3).join(', ')}
                      </p>
                      {m.availability?.[s.slug] && m.availability[s.slug].length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {m.availability[s.slug].slice(0, 3).map((a) => (
                            <Link
                              key={a.slug}
                              href={`/dispensaries/${a.slug}`}
                              className="rounded-full border border-canopy-border px-2 py-0.5 text-[11px] text-canopy-muted hover:border-canopy-green hover:text-canopy-green"
                            >
                              {a.name} ({a.city}, {a.state}){a.price ? ` · $${a.price}` : ''}
                            </Link>
                          ))}
                        </div>
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
