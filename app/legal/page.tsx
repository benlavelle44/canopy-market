import { STATE_LAWS, STATUS_LABEL, STATUS_COLOR } from '@/lib/stateLaws';

export const metadata = {
  title: 'Legal & Compliance by State — Canopy Market',
};

export default function LegalPage() {
  const groups = {
    recreational: STATE_LAWS.filter((s) => s.status === 'recreational'),
    medical: STATE_LAWS.filter((s) => s.status === 'medical'),
    'cbd-only': STATE_LAWS.filter((s) => s.status === 'cbd-only'),
    illegal: STATE_LAWS.filter((s) => s.status === 'illegal'),
  } as const;

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <div className="mb-6 text-center">
        <h1 className="font-groovy text-4xl text-gradient-trippy">Legal &amp; Compliance</h1>
        <p className="mx-auto mt-3 max-w-2xl text-canopy-muted">
          Cannabis law is federal-plus-50-different-state-laws, and it's changing fast — a DEA
          hearing on broader rescheduling wrapped up this month. This page is a starting map, not
          legal advice. Always confirm with your state's cannabis regulatory agency before making
          business or purchase decisions.
        </p>
      </div>

      <div className="mb-10 rounded-2xl border border-canopy-border bg-canopy-panel p-6 leaf-texture">
        <h2 className="mb-3 font-groovy text-lg">The federal picture right now</h2>
        <ul className="space-y-2 text-sm text-canopy-muted">
          <li>
            • Cannabis is a Schedule I controlled substance federally — <span className="text-canopy-text">except</span> FDA-approved
            marijuana drug products and state-licensed medical marijuana, which the DOJ moved to
            Schedule III on April 23, 2026.
          </li>
          <li>
            • Recreational/adult-use marijuana remains Schedule I. A DEA hearing on broader
            rescheduling ran June 29–July 15, 2026; a final decision from the DEA Administrator is
            still pending.
          </li>
          <li>
            • Interstate cannabis commerce is illegal everywhere, even between two legal states.
            Oregon and California have compact laws ready to go, but both require federal
            authorization that hasn't happened yet.
          </li>
        </ul>
      </div>

      <div className="space-y-10">
        {(
          [
            ['recreational', groups.recreational],
            ['medical', groups.medical],
            ['cbd-only', groups['cbd-only']],
            ['illegal', groups.illegal],
          ] as const
        ).map(([status, states]) => (
          <div key={status}>
            <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
              <span className={`rounded-full border px-3 py-1 text-xs ${STATUS_COLOR[status]}`}>
                {STATUS_LABEL[status]}
              </span>
              <span className="text-sm text-canopy-muted">({states.length} states)</span>
            </h2>
            <div className="flex flex-wrap gap-2">
              {states.map((s) => (
                <span
                  key={s.code}
                  className="rounded-full border border-canopy-border bg-canopy-card px-3 py-1.5 text-sm"
                >
                  {s.name}
                </span>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-12 rounded-2xl border border-canopy-border bg-canopy-card p-6 text-sm text-canopy-muted">
        <h2 className="mb-2 font-groovy text-base text-canopy-text">For exact, current details</h2>
        <p className="mb-3">
          Possession limits, purchase age, home-grow rules, and licensing requirements vary by
          state and change often. Check these authoritative sources before relying on anything:
        </p>
        <ul className="space-y-1">
          <li>
            <a href="https://www.dea.gov/marijuana-rescheduling-regulatory-actions" target="_blank" rel="noopener noreferrer" className="text-canopy-green hover:underline">
              DEA — Marijuana Rescheduling Regulatory Actions
            </a>
          </li>
          <li>
            <a href="https://en.wikipedia.org/wiki/Legality_of_cannabis_by_U.S._jurisdiction" target="_blank" rel="noopener noreferrer" className="text-canopy-green hover:underline">
              Legality of Cannabis by U.S. Jurisdiction — continuously updated overview
            </a>
          </li>
          <li>
            <a href="https://www.congress.gov/crs-product/IF12270" target="_blank" rel="noopener noreferrer" className="text-canopy-green hover:underline">
              Congressional Research Service — Federal Status of Marijuana
            </a>
          </li>
        </ul>
      </div>
    </div>
  );
}
