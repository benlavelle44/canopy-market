'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { Product, ProductCategory, PRODUCT_CATEGORIES, Dispensary } from '@/lib/types';

type ShopItem = Product & { dispensaries: Pick<Dispensary, 'id' | 'name' | 'slug' | 'city' | 'state' | 'tier'> | null };

export default function ShopPage() {
  const supabase = createClient();
  const [items, setItems] = useState<ShopItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [category, setCategory] = useState<ProductCategory | 'all'>('all');
  const [query, setQuery] = useState('');

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from('products')
        .select('*, dispensaries!inner(id, name, slug, city, state, tier, status)')
        .eq('in_stock', true)
        .eq('dispensaries.status', 'approved')
        .order('created_at', { ascending: false })
        .limit(300);
      setItems((data || []) as any);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    return items.filter((i) => {
      if (category !== 'all' && i.category !== category) return false;
      if (query.trim()) {
        const q = query.toLowerCase();
        if (!i.name.toLowerCase().includes(q) && !(i.brand || '').toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [items, category, query]);

  const counts = useMemo(() => {
    const map: Record<string, number> = {};
    for (const i of items) map[i.category] = (map[i.category] || 0) + 1;
    return map;
  }, [items]);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <div className="mb-8 text-center">
        <h1 className="font-groovy text-4xl text-gradient-trippy">The Canopy Shop</h1>
        <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
          Flower, prerolls, dabs, vapes, edibles, tinctures, topicals, and accessories — every
          category, every dispensary on Canopy, in one place. Every order happens directly through
          the dispensary's own site.
        </p>
      </div>

      <div className="mb-6 flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={() => setCategory('all')}
          className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
            category === 'all'
              ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
              : 'border-canopy-border text-canopy-muted hover:border-canopy-green'
          }`}
        >
          All ({items.length})
        </button>
        {PRODUCT_CATEGORIES.map((c) => (
          <button
            key={c.id}
            onClick={() => setCategory(c.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              category === c.id
                ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                : 'border-canopy-border text-canopy-muted hover:border-canopy-green'
            }`}
          >
            {c.label} ({counts[c.id] || 0})
          </button>
        ))}
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search by product or brand name…"
        className="mx-auto mb-8 block w-full max-w-md rounded-full border border-canopy-border bg-canopy-panel px-5 py-2.5 text-sm focus:border-canopy-green focus:outline-none"
      />

      {loading ? (
        <p className="text-center text-canopy-muted">Loading the shop…</p>
      ) : filtered.length === 0 ? (
        <p className="text-center text-canopy-muted">
          Nothing here yet.{' '}
          <Link href="/dispensary-signup" className="text-canopy-green hover:underline">
            Dispensaries can list products free →
          </Link>
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((item) => (
            <Link
              key={item.id}
              href={item.dispensaries ? `/dispensaries/${item.dispensaries.slug}` : '#'}
              className="flex flex-col justify-between rounded-2xl border border-canopy-border bg-canopy-card p-5 transition hover:border-canopy-green/50"
            >
              <div>
                <span className="mb-2 inline-block rounded-full border border-canopy-border px-2 py-0.5 text-[11px] text-canopy-muted">
                  {PRODUCT_CATEGORIES.find((c) => c.id === item.category)?.label || item.category}
                </span>
                <h3 className="font-semibold">{item.name}</h3>
                {item.brand && <p className="text-xs text-canopy-muted">{item.brand}</p>}
                {(item.thc || item.cbd) && (
                  <p className="mt-1 text-xs text-canopy-muted">
                    {item.thc ? `THC ${item.thc}%` : ''}
                    {item.thc && item.cbd ? ' · ' : ''}
                    {item.cbd ? `CBD ${item.cbd}%` : ''}
                  </p>
                )}
              </div>
              <div className="mt-3 flex items-center justify-between">
                <span className="text-xs text-canopy-muted">
                  {item.dispensaries?.name}
                  {item.dispensaries?.city ? ` · ${item.dispensaries.city}, ${item.dispensaries.state}` : ''}
                </span>
                <span className="font-semibold text-canopy-green">{item.price ? `$${item.price}` : '—'}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
