'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabaseClient';

const COOKIE_NAME = 'canopy_state';

// Kept in sync with lib/shopperState.ts's SUPPORTED_STATES -- duplicated
// here (with display names) because that file pulls in next/headers, which
// can't be imported into a Client Component bundle.
const STATES = [
  { code: 'AZ', name: 'Arizona' },
  { code: 'CA', name: 'California' },
  { code: 'CO', name: 'Colorado' },
  { code: 'IL', name: 'Illinois' },
  { code: 'MI', name: 'Michigan' },
  { code: 'MT', name: 'Montana' },
  { code: 'NY', name: 'New York' },
];

function readCookie(name: string): string | null {
  const match = document.cookie.match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return match ? decodeURIComponent(match[1]) : null;
}

// Cannabis can't legally cross state lines -- every dispensary listing,
// product, and AI recommendation in this app needs to be scoped to
// whichever state is stored in the canopy_state cookie. This gate makes
// sure that cookie is always set before a shopper sees state-scoped
// content: a signed-in shopper with a saved profiles.state gets it applied
// silently, everyone else picks once and every page (Server and Client
// Components alike) reads the same cookie from then on. Renders after
// AgeGate in the layout and sits one z-index layer behind it (z-95 vs
// z-100), so it's invisible while the age gate is up and only appears once
// that's been dismissed -- no extra coordination logic needed.
export default function StateGate() {
  const [open, setOpen] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    (async () => {
      if (readCookie(COOKIE_NAME)) {
        setChecking(false);
        return;
      }
      const supabase = createClient();
      const { data } = await supabase.auth.getSession();
      const user = data.session?.user;
      if (user) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('state')
          .eq('id', user.id)
          .maybeSingle();
        const savedState = (profile as any)?.state;
        if (savedState && STATES.some((s) => s.code === savedState)) {
          await save(savedState, data.session?.access_token);
          setChecking(false);
          return;
        }
      }
      setChecking(false);
      setOpen(true);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const save = async (state: string, accessToken?: string) => {
    document.cookie = `${COOKIE_NAME}=${state}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
    try {
      await fetch('/api/shopper-state', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          ...(accessToken ? { authorization: `Bearer ${accessToken}` } : {}),
        },
        body: JSON.stringify({ state }),
      });
    } catch {
      // Cookie's already set client-side -- a failed save just means it
      // won't sync to profile.state for next time. Browsing still works.
    }
  };

  const choose = async (state: string) => {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    await save(state, data.session?.access_token);
    setOpen(false);
    window.location.reload();
  };

  if (checking || !open) return null;

  return (
    <div className="fixed inset-0 z-[95] flex items-center justify-center bg-black/90 p-4 leaf-texture">
      <div className="w-full max-w-sm rounded-3xl border border-canopy-green/30 bg-canopy-panel p-6 text-center shadow-glow">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-canopy-green/30 to-canopy-purple/30 text-3xl">
          📍
        </div>
        <h2 className="mb-2 font-groovy text-2xl text-gradient-trippy">Which state are you shopping in?</h2>
        <p className="mb-6 text-sm text-canopy-muted">
          Cannabis can't legally cross state lines, so we only show dispensaries and products
          licensed in your state. Change this anytime from the nav.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {STATES.map((s) => (
            <button
              key={s.code}
              onClick={() => choose(s.code)}
              className="rounded-xl border border-canopy-border px-3 py-2.5 text-sm font-medium text-canopy-text transition hover:border-canopy-green hover:bg-canopy-card"
            >
              {s.name}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
