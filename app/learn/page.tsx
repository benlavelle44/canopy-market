import Link from 'next/link';

const SECTIONS = [
  { id: 'types', label: 'Indica vs Sativa vs Hybrid' },
  { id: 'terpenes', label: 'Terpenes 101' },
  { id: 'thc-cbd', label: 'THC & CBD Explained' },
  { id: 'methods', label: 'Consumption Methods' },
  { id: 'dosing', label: 'Dosing & Safety' },
  { id: 'legal', label: 'Know the Law' },
];

export default function LearnPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <div className="mb-10 text-center">
        <h1 className="font-groovy text-4xl text-gradient-trippy">Learn Cannabis</h1>
        <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
          The basics, explained clearly — for people who are curious, new, or just want a
          refresher before they browse.
        </p>
      </div>

      <nav className="mb-12 flex flex-wrap justify-center gap-2">
        {SECTIONS.map((s) => (
          <a
            key={s.id}
            href={`#${s.id}`}
            className="rounded-full border border-canopy-border px-3 py-1.5 text-xs text-canopy-muted hover:border-canopy-green hover:text-canopy-green"
          >
            {s.label}
          </a>
        ))}
      </nav>

      <div className="space-y-14">
        <section id="types" className="scroll-mt-24">
          <h2 className="mb-3 font-groovy text-2xl">Indica vs Sativa vs Hybrid</h2>
          <p className="text-canopy-muted">
            These categories describe a strain's traditional plant lineage more than a guaranteed
            effect — modern strains are almost all hybrids of the two, and effects vary a lot by
            individual chemistry and dose. Still, as a rough guide: <span className="text-canopy-text">Indica</span>-leaning
            strains tend to be associated with relaxation, heaviness, and nighttime use.{' '}
            <span className="text-canopy-text">Sativa</span>-leaning strains tend to be associated
            with energy, focus, and daytime use. <span className="text-canopy-text">Hybrids</span>{' '}
            blend both, and where a specific hybrid lands depends on its parent strains and its
            terpene profile — which is often a better predictor of effect than the
            indica/sativa label alone.
          </p>
        </section>

        <section id="terpenes" className="scroll-mt-24">
          <h2 className="mb-3 font-groovy text-2xl">Terpenes 101</h2>
          <p className="mb-3 text-canopy-muted">
            Terpenes are the aromatic compounds that give each strain its smell and flavor — and
            they're believed to shape effects too, working alongside THC and CBD (the
            "entourage effect"). A few common ones you'll see on strain pages here:
          </p>
          <ul className="space-y-2 text-sm text-canopy-muted">
            <li><span className="text-canopy-text">Myrcene</span> — earthy, musky; associated with sedation and relaxation.</li>
            <li><span className="text-canopy-text">Limonene</span> — citrusy; associated with elevated mood.</li>
            <li><span className="text-canopy-text">Caryophyllene</span> — peppery, spicy; the only terpene known to also act on cannabinoid receptors directly.</li>
            <li><span className="text-canopy-text">Pinene</span> — pine-like; associated with alertness.</li>
            <li><span className="text-canopy-text">Linalool</span> — floral, lavender-like; associated with calm.</li>
          </ul>
        </section>

        <section id="thc-cbd" className="scroll-mt-24">
          <h2 className="mb-3 font-groovy text-2xl">THC &amp; CBD, Explained</h2>
          <p className="text-canopy-muted">
            <span className="text-canopy-text">THC</span> (tetrahydrocannabinol) is the primary
            psychoactive compound in cannabis — it's what produces the "high." Higher THC% means
            more potential intensity, not necessarily more of any particular effect.{' '}
            <span className="text-canopy-text">CBD</span> (cannabidiol) is non-intoxicating and is
            often sought for relaxation and general wellness without a strong high. Strains with
            balanced or high CBD relative to THC (like the ones tagged "high-CBD" on this site)
            are a common starting point for people who want the plant's effects without much
            psychoactivity.
          </p>
        </section>

        <section id="methods" className="scroll-mt-24">
          <h2 className="mb-3 font-groovy text-2xl">Consumption Methods</h2>
          <ul className="space-y-2 text-sm text-canopy-muted">
            <li><span className="text-canopy-text">Smoking / flower</span> — fast onset (minutes), effects fade in 1–3 hours, easiest to dose gradually.</li>
            <li><span className="text-canopy-text">Vaporizing</span> — fast onset like smoking, generally considered to reduce inhalation of combustion byproducts.</li>
            <li><span className="text-canopy-text">Edibles</span> — slow onset (30 minutes to 2+ hours), longer duration (4–8 hours), much easier to over-consume before feeling the first effects — start very low.</li>
            <li><span className="text-canopy-text">Tinctures / sublingual</span> — faster onset than edibles (15–45 minutes), easier to dose precisely with drops.</li>
            <li><span className="text-canopy-text">Topicals</span> — applied to skin, generally non-intoxicating, used for localized relief.</li>
          </ul>
        </section>

        <section id="dosing" className="scroll-mt-24">
          <h2 className="mb-3 font-groovy text-2xl">Dosing &amp; Safety</h2>
          <p className="text-canopy-muted">
            "Start low, go slow" is the standard guidance for a reason — especially with edibles,
            where effects take time to appear and it's easy to take more before you feel anything.
            Consider your tolerance, avoid mixing with alcohol, don't drive or operate machinery
            after use, store products securely away from children and pets, and check with a
            doctor before use if you're pregnant, nursing, have a heart condition, or take
            medications that might interact. Nothing on this site is medical advice — for medical
            use, talk to a healthcare provider familiar with cannabis.
          </p>
        </section>

        <section id="legal" className="scroll-mt-24">
          <h2 className="mb-3 font-groovy text-2xl">Know the Law</h2>
          <p className="text-canopy-muted">
            Legal status varies dramatically by state, and cannabis remains federally restricted
            even where state law allows it. See our{' '}
            <Link href="/legal" className="text-canopy-green hover:underline">
              Legal &amp; Compliance hub
            </Link>{' '}
            for a state-by-state breakdown and the current federal picture.
          </p>
        </section>
      </div>
    </div>
  );
}
