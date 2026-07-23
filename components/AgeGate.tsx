'use client';

import { useEffect, useState } from 'react';

// Two-step entry gate: (1) confirm legal age, (2) accept a short site-wide
// disclaimer -- both required before the shopper sees any product info.
// Stored under a new key so everyone (including people who already cleared
// the old single-step gate) sees the disclaimer step once.
const STORAGE_KEY = 'canopy_entry_v2';

type Step = 'age' | 'disclaimer' | null;

export default function AgeGate() {
  const [step, setStep] = useState<Step>(null);

  useEffect(() => {
    const confirmed = typeof window !== 'undefined' && localStorage.getItem(STORAGE_KEY);
    if (!confirmed) setStep('age');
  }, []);

  if (!step) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 p-4 leaf-texture">
      <div className="w-full max-w-sm rounded-3xl border border-canopy-green/30 bg-canopy-panel p-6 text-center shadow-glow">
        <div className="mx-auto mb-4 flex h-16 w-16 animate-pulseglow items-center justify-center rounded-full bg-gradient-to-br from-canopy-green/30 to-canopy-purple/30 text-3xl">
          {step === 'age' ? '🌿' : '📋'}
        </div>

        <p className="mb-3 text-[11px] uppercase tracking-wide text-canopy-muted">Step {step === 'age' ? '1' : '2'} of 2</p>

        {step === 'age' && (
          <>
            <h2 className="mb-2 font-groovy text-2xl text-gradient-trippy">Are you 21 or older?</h2>
            <p className="mb-6 text-sm text-canopy-muted">
              Canopy Market shows cannabis product information. You must be of legal age in your
              state to continue.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => setStep('disclaimer')}
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
          </>
        )}

        {step === 'disclaimer' && (
          <>
            <h2 className="mb-2 font-groovy text-2xl text-gradient-trippy">Quick disclaimer</h2>
            <p className="mb-6 text-left text-xs leading-relaxed text-canopy-muted">
              Canopy Market provides cannabis product and strain information for informational
              purposes only — nothing here is medical advice. Product availability and legality
              vary by state. AI-researched strain data are general estimates, not lab-verified.
              By continuing, you agree to use this information responsibly and confirm cannabis
              is legal for you where you're located.
            </p>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  localStorage.setItem(STORAGE_KEY, '1');
                  setStep(null);
                }}
                className="btn-glow w-full rounded-xl bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-4 py-3 font-semibold text-black transition"
              >
                I Accept — Continue
              </button>
              <button
                onClick={() => setStep('age')}
                className="w-full rounded-xl border border-canopy-border px-4 py-3 font-semibold text-canopy-muted transition hover:bg-canopy-card"
              >
                Back
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
