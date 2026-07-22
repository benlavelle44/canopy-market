import { notFound } from 'next/navigation';
import Link from 'next/link';
import { createServerReadClient } from '@/lib/supabaseServer';
import { Dispensary, Product, Strain, PRODUCT_CATEGORIES } from '@/lib/types';
import TypeBadge from '@/components/TypeBadge';

export const revalidate = 0;

async function getDispensary(slug: string) {
  const supabase = createServerReadClient();
  const { data: dispensary } = await supabase
    .from('dispensaries')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();
  if (!dispensary) return null;

  const { data: products } = await supabase
    .from('products')
    .select('*, strains(*)')
    .eq('dispensary_id', dispensary.id)
    .order('category');

  return {
    dispensary: dispensary as Dispensary,
    products: (products || []) as (Product & { strains: Strain | null })[],
  };
}

export default async function DispensaryDetailPage({ params }: { params: { slug: string } }) {
  const result = await getDispensary(params.slug);
  if (!result) notFound();
  const { dispensary, products } = result;

  const byCategory = PRODUCT_CATEGORIES.map((c) => ({
    ...c,
    items: products.filter((p) => p.category === c.id),
  })).filter((c) => c.items.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-6 h-40 w-full rounded-2xl bg-gradient-to-br from-canopy-green/20 via-canopy-panel to-canopy-purple/20" />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="mb-1 flex items-center gap-3">
            <h1 className="text-3xl font-bold">{dispensary.name}</h1>
            {dispensary.status === 'pending' && (
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-xs font-medium text-yellow-400">
                Pending Verification
              </span>
            )}
          </div>
          <p className="text-canopy-muted">
            {dispensary.address ? `${dispensary.address}, ` : ''}
            {dispensary.city}, {dispensary.state} {dispensary.zip}
          </p>
          {dispensary.phone && <p className="text-sm text-canopy-muted">{dispensary.phone}</p>}
        </div>
        {dispensary.website_url && (
          <a
            href={dispensary.website_url}
            target="_blank"
            rel="noopener noreferrer"
            className="btn-glow rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-6 py-3 font-semibold text-black"
          >
            Order on their site →
          </a>
        )}
      </div>

      {dispensary.description && <p className="mt-5 max-w-2xl text-canopy-text">{dispensary.description}</p>}

      <div className="mt-8 grid gap-8 md:grid-cols-[1fr_260px]">
        <section>
          <h2 className="mb-4 text-xl font-semibold">Menu</h2>
          {products.length === 0 ? (
            <p className="text-sm text-canopy-muted">This dispensary hasn't listed products yet.</p>
          ) : (
            <div className="space-y-6">
              {byCategory.map((c) => (
                <div key={c.id}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-canopy-green">
                    {c.label}
                  </h3>
                  <div className="grid gap-3 sm:grid-cols-2">
                    {c.items.map((p) =>
                      p.strains ? (
                        <Link
                          key={p.id}
                          href={`/strains/${p.strains.slug}`}
                          className="flex items-center justify-between rounded-xl border border-canopy-border bg-canopy-card p-4 transition hover:border-canopy-green/50"
                        >
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="font-medium">{p.strains.name}</span>
                              <TypeBadge type={p.strains.type} />
                            </div>
                            <p className="text-xs text-canopy-muted">
                              THC {p.strains.thc}% · CBD {p.strains.cbd}%
                            </p>
                          </div>
                          <span className="font-semibold text-canopy-green">{p.price ? `$${p.price}` : '—'}</span>
                        </Link>
                      ) : (
                        <div
                          key={p.id}
                          className="flex items-center justify-between rounded-xl border border-canopy-border bg-canopy-card p-4"
                        >
                          <div>
                            <span className="font-medium">{p.name}</span>
                            {p.brand && <span className="ml-2 text-xs text-canopy-muted">{p.brand}</span>}
                            {(p.thc || p.cbd) && (
                              <p className="text-xs text-canopy-muted">
                                {p.thc ? `THC ${p.thc}%` : ''}
                                {p.thc && p.cbd ? ' · ' : ''}
                                {p.cbd ? `CBD ${p.cbd}%` : ''}
                              </p>
                            )}
                          </div>
                          <span className="font-semibold text-canopy-green">{p.price ? `$${p.price}` : '—'}</span>
                        </div>
                      )
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <aside className="space-y-4">
          <div className="rounded-xl border border-canopy-border bg-canopy-card p-4">
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-canopy-muted">
              Hours
            </h3>
            <ul className="space-y-1 text-sm text-canopy-muted">
              {Object.entries(dispensary.hours || {}).map(([day, hrs]) => (
                <li key={day} className="flex justify-between">
                  <span className="capitalize">{day}</span>
                  <span>{hrs}</span>
                </li>
              ))}
            </ul>
          </div>
          {dispensary.license_number && (
            <div className="rounded-xl border border-canopy-border bg-canopy-card p-4">
              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-canopy-muted">
                License
              </h3>
              <p className="text-sm text-canopy-muted">{dispensary.license_number}</p>
            </div>
          )}
        </aside>
      </div>
    </div>
  );
}
