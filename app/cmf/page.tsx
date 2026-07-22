import Link from 'next/link';
import { CMF_HEADERS, CMF_VERSION } from '@/lib/cmf';
import DownloadCmfTemplateButton from '@/components/DownloadCmfTemplateButton';

export const metadata = {
  title: 'Canopy Menu Feed (CMF-1) — Open Menu Data Standard',
};

const COLUMN_DOCS: { col: string; required: boolean; desc: string }[] = [
  { col: 'category', required: true, desc: 'One of: flower, preroll, concentrate, vape, edible, tincture, topical, accessory, other.' },
  { col: 'name', required: true, desc: 'Product name as shown on the menu, e.g. "Blue Dream" or "Watermelon Gummies 100mg".' },
  { col: 'brand', required: false, desc: 'Cultivator or brand name, if different from the dispensary itself.' },
  { col: 'strain_slug', required: false, desc: 'Links a flower/preroll/vape product to a known strain in the Canopy strain database (e.g. "blue-dream"). Leave blank if there\'s no matching strain, or if the strain isn\'t in the database yet.' },
  { col: 'sku', required: false, desc: 'Your own internal SKU or POS product ID. Recommended -- lets re-imports update the same row instead of creating duplicates.' },
  { col: 'price', required: false, desc: 'Numeric price, no currency symbol, e.g. 35 or 35.00.' },
  { col: 'thc', required: false, desc: 'THC percentage as a plain number, e.g. 22.5 (not "22.5%").' },
  { col: 'cbd', required: false, desc: 'CBD percentage as a plain number.' },
  { col: 'in_stock', required: false, desc: 'true/false (or yes/no, 1/0). Defaults to true if omitted.' },
  { col: 'description', required: false, desc: 'Free text. Wrap in double quotes if it contains commas.' },
  { col: 'image_url', required: false, desc: 'Public URL to a product photo, if you have one.' },
];

export default function CmfSpecPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-14">
      <div className="mb-8">
        <span className="rounded-full border border-canopy-green/40 bg-canopy-green/10 px-3 py-1 text-xs font-medium text-canopy-green">
          Open Standard · v{CMF_VERSION}
        </span>
        <h1 className="mt-4 font-groovy text-4xl text-gradient-trippy">Canopy Menu Feed (CMF-1)</h1>
        <p className="mx-auto mt-4 max-w-2xl text-canopy-muted">
          Cannabis has no ADF/XML -- no single, shared way for a dispensary's menu to move between
          a POS system, a marketplace, and a website without someone re-typing it by hand. CMF-1 is
          our attempt to fix that: one open, simple CSV schema that any dispensary, POS/seed-to-sale
          platform, or menu site can read or write. It's free to use, requires no license, and isn't
          exclusive to Canopy Market -- if it's useful to Leafly, Weedmaps, or a state system, use it.
        </p>
      </div>

      <div className="mb-10 flex flex-wrap items-center gap-3 rounded-2xl border border-canopy-border bg-canopy-panel p-6">
        <div className="flex-1">
          <h2 className="mb-1 font-groovy text-lg">Get the template</h2>
          <p className="text-sm text-canopy-muted">
            A ready-to-fill CSV with the correct header row and two example rows (a flower product
            and an edible).
          </p>
        </div>
        <DownloadCmfTemplateButton />
      </div>

      <section className="mb-10">
        <h2 className="mb-3 font-groovy text-lg">Why a standard instead of an API</h2>
        <p className="text-sm text-canopy-text">
          Every POS (Dutchie, Flowhub, Jane, Treez, Cova, Blaze, LeafLogix...) already exports data
          in its own shape, and every marketplace expects its own shape back. That N×M problem is
          exactly what automotive solved decades ago with ADF/XML for lead data -- one shared format
          any CRM or dealer site can read, regardless of who built it. CMF-1 does the same job for
          menu/inventory data: export once in this shape, and it drops into Canopy (and, if others
          adopt it, anywhere else) without a bespoke integration.
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-groovy text-lg">File format</h2>
        <p className="mb-4 text-sm text-canopy-text">
          Plain CSV, UTF-8, comma-delimited, with a header row exactly matching the column names
          below (order doesn't matter for our importer, but matching the standard order is
          recommended). One row per product/listing.
        </p>
        <div className="overflow-x-auto rounded-2xl border border-canopy-border">
          <table className="w-full text-left text-sm">
            <thead className="bg-canopy-panel text-canopy-muted">
              <tr>
                <th className="px-4 py-2 font-medium">Column</th>
                <th className="px-4 py-2 font-medium">Required</th>
                <th className="px-4 py-2 font-medium">Description</th>
              </tr>
            </thead>
            <tbody>
              {COLUMN_DOCS.map((c, i) => (
                <tr key={c.col} className={i % 2 === 0 ? 'bg-canopy-card' : 'bg-canopy-bg'}>
                  <td className="px-4 py-2 font-mono text-canopy-green">{c.col}</td>
                  <td className="px-4 py-2 text-xs text-canopy-muted">{c.required ? 'Required' : 'Optional'}</td>
                  <td className="px-4 py-2 text-canopy-text">{c.desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-canopy-muted">
          Header order used by the reference template: {CMF_HEADERS.join(', ')}
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-groovy text-lg">Matching to the strain database</h2>
        <p className="text-sm text-canopy-text">
          If <code className="font-mono text-canopy-green">strain_slug</code> matches a strain
          already in Canopy's database, your listing links straight into that strain's page --
          shoppers see your price and stock status alongside the full genetics, terpene, and effect
          profile, and your product shows up in strain-level search. Don't know the slug? Browse{' '}
          <Link href="/strains" className="text-canopy-green hover:underline">
            /strains
          </Link>{' '}
          -- it's the last part of the URL (e.g. <code className="font-mono">/strains/blue-dream</code>{' '}
          → <code className="font-mono">blue-dream</code>). Leave it blank for products with no
          strain match (edibles, accessories, or a strain not yet in the database).
        </p>
      </section>

      <section className="mb-10">
        <h2 className="mb-3 font-groovy text-lg">How re-imports work</h2>
        <p className="text-sm text-canopy-text">
          Uploading a new CMF-1 file from your dashboard replaces your current menu with what's in
          the file -- rows with a matching <code className="font-mono text-canopy-green">sku</code>{' '}
          update the existing listing in place (price, stock, etc.); rows with a new SKU are added;
          previous listings whose SKU no longer appears in the file are removed. If you don't use
          SKUs, matching falls back to category + name, which works fine for a small menu but is
          less precise for large catalogs -- we recommend including a SKU wherever your POS has one.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-groovy text-lg">Import it now</h2>
        <p className="text-sm text-canopy-text">
          Dispensary owners can upload a CMF-1 CSV directly from{' '}
          <Link href="/dashboard" className="text-canopy-green hover:underline">
            the dashboard
          </Link>
          , under each storefront's Menu section.
        </p>
      </section>
    </div>
  );
}
