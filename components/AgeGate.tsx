'use client';

import { useEffect, useState } from 'react';

export default function AgeGate() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const confirmed = typeof window !== 'undefined' && localStorage.getItem('canopy_age_confirmed');
    if (!confirmed) setShow(true);
  }, []);

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 leaf-texture">
      <div className="w-full max-w-sm rounded-3xl border border-canopy-green/30 bg-canopy-panel p-6 text-center shadow-glow">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-pulseglow items-center justify-center rounded-full bg-gradient-to-br from-canopy-green/30 to-canopy-purple/30 text-3xl">
          🌿
        </div>
        <h2 className="mb-2 font-groovy text-2xl text-gradient-trippy">Are you 21 or older?</h2>
        <p className="mb-6 text-sm text-canopy-muted">
          Canopy Market shows cannabis product information. You must be of legal age in your
          state to continue.
        </p>
        <div className="flex flex-col gap-2">
          <button
            onClick={() => {
              localStorage.setItem('canopy_age_confirmed', '1');
              setShow(false);
            }}
            className="btn-glow w-full rounded-xl bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-4 py-3 font-semibold text-black transition"
          >
            I'm 21+ — Enter
          </button>
          <a
            href="https://www.google.com"
            className="w-full rounded-xl border border-canopy-border px-4 py-3 font-semibold text-canopy-muted transition hover:bg-canopy-card"
          >
            I'm not 21
          </a>
        </div>
      </div>
    </div>
  );
}
