export const metadata = {
  title: "What's New — Canopy Market",
  description: "The latest features, drops, and updates on Canopy Market.",
};

interface Entry {
  date: string;
  tag: string;
  title: string;
  body: string;
}

// Simple, hand-edited log for now -- no CMS. Add a new entry to the top of
// this array whenever there's something worth telling shoppers about.
// Newest first.
const ENTRIES: Entry[] = [
  {
    date: 'August 2026',
    tag: 'Merch',
    title: 'Canopy Merch is live',
    body: "Hoodies, tees, long sleeves, hats, and stickers repping Kief are now in the shop. New designs drop through the year — check /merch for what's currently available.",
  },
  {
    date: 'August 2026',
    tag: 'Kief',
    title: 'Kief got a lot smarter',
    body: "Kief now actually answers cannabis knowledge questions in depth -- consumption methods, dosing, terpenes, extraction, storage -- instead of only matching you to products. Ask him anything, not just \"what should I try.\"",
  },
  {
    date: 'August 2026',
    tag: 'Seasonal',
    title: 'Fall harvest season',
    body: "Dispensaries are bringing in this season's fresh harvest. Browse strains to see what's newly in stock near you.",
  },
];

const TAG_COLOR: Record<string, string> = {
  Merch: 'text-canopy-purple border-canopy-purple/40',
  Kief: 'text-canopy-green border-canopy-green/40',
  Seasonal: 'text-canopy-gold border-canopy-gold/40',
};

export default function WhatsNewPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <div className="mb-10 text-center">
        <h1 className="font-groovy text-4xl text-gradient-trippy">What&apos;s New</h1>
        <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
          Features, drops, and updates on Canopy Market, newest first.
        </p>
      </div>

      <div className="space-y-6">
        {ENTRIES.map((e) => (
          <div key={e.title} className="rounded-2xl border border-canopy-border bg-canopy-panel p-6">
            <div className="mb-2 flex flex-wrap items-center gap-2">
              <span className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TAG_COLOR[e.tag] || 'text-canopy-muted border-canopy-border'}`}>
                {e.tag}
              </span>
              <span className="text-xs text-canopy-muted">{e.date}</span>
            </div>
            <h2 className="mb-1.5 text-lg font-semibold">{e.title}</h2>
            <p className="text-sm text-canopy-muted">{e.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
