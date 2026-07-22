'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { Dispensary, Product, ProductCategory, PRODUCT_CATEGORIES, Strain } from '@/lib/types';
import DownloadCmfTemplateButton from '@/components/DownloadCmfTemplateButton';

type OwnedDispensary = Dispensary & {
  products: Product[];
};

const TIER_LABEL: Record<string, string> = {
  free: 'Free',
  pro: 'Pro',
  verified: 'Verified',
};

const CATEGORY_LABEL: Record<string, string> = Object.fromEntries(
  PRODUCT_CATEGORIES.map((c) => [c.id, c.label])
);

export default function DashboardClient() {
  const supabase = createClient();
  const router = useRouter();
  const params = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [dispensaries, setDispensaries] = useState<OwnedDispensary[]>([]);
  const [allStrains, setAllStrains] = useState<Strain[]>([]);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');

  const load = async () => {
    const { data: sessionData } = await supabase.auth.getSession();
    const user = sessionData.session?.user;
    if (!user) {
      router.push('/login');
      return;
    }
    setUserId(user.id);
    setUserEmail(user.email ?? null);

    const [{ data: disp }, { data: strains }] = await Promise.all([
      supabase.from('dispensaries').select('*').eq('owner_id', user.id).order('created_at'),
      supabase.from('strains').select('*').order('name'),
    ]);

    const dispList = disp || [];
    const withProducts: OwnedDispensary[] = [];
    for (const d of dispList) {
      const { data: products } = await supabase
        .from('products')
        .select('*')
        .eq('dispensary_id', d.id)
        .order('category');
      withProducts.push({ ...(d as Dispensary), products: (products || []) as any });
    }

    setDispensaries(withProducts);
    setAllStrains((strains || []) as Strain[]);
    setLoading(false);
  };

  useEffect(() => {
    load();
    if (params.get('upgraded')) {
      setNotice('Upgrade complete! It may take a minute for your new tier to show up.');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateDispensaryField = (id: string, field: keyof Dispensary, value: any) => {
    setDispensaries((prev) => prev.map((d) => (d.id === id ? { ...d, [field]: value } : d)));
  };

  const saveDispensary = async (d: OwnedDispensary) => {
    setSavingId(d.id);
    await supabase
      .from('dispensaries')
      .update({
        description: d.description,
        phone: d.phone,
        website_url: d.website_url,
        address: d.address,
        city: d.city,
        state: d.state,
        zip: d.zip,
      })
      .eq('id', d.id);
    setSavingId(null);
    setNotice('Saved.');
    setTimeout(() => setNotice(''), 2000);
  };

  const addProduct = async (dispensaryId: string, fields: Partial<Product>) => {
    if (!fields.name) return;
    await supabase.from('products').insert({
      dispensary_id: dispensaryId,
      category: fields.category || 'flower',
      strain_id: fields.strain_id || null,
      name: fields.name,
      brand: fields.brand || null,
      description: fields.description || null,
      price: fields.price ?? null,
      thc: fields.thc ?? null,
      cbd: fields.cbd ?? null,
      in_stock: true,
    });
    load();
  };

  const updateProduct = async (productId: string, fields: Partial<Product>) => {
    await supabase.from('products').update(fields).eq('id', productId);
  };

  const removeProduct = async (productId: string) => {
    await supabase.from('products').delete().eq('id', productId);
    load();
  };

  const importMenu = async (dispensaryId: string, csv: string) => {
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData.session?.access_token;
    if (!token) return { error: 'You need to be signed in.' };
    const res = await fetch('/api/products/import', {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
      body: JSON.stringify({ dispensaryId, csv }),
    });
    const data = await res.json();
    if (res.ok) load();
    return data;
  };

  const upgrade = async (dispensaryId: string, tier: 'pro' | 'verified') => {
    const res = await fetch('/api/stripe/checkout', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ dispensaryId, tier, email: userEmail }),
    });
    const data = await res.json();
    if (data.url) {
      window.location.href = data.url;
    } else {
      setNotice(data.error || 'Upgrade is not available yet.');
    }
  };

  if (loading) {
    return <div className="mx-auto max-w-5xl px-4 py-20 text-center text-canopy-muted">Loading your dashboard…</div>;
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-10">
      <div className="mb-8 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-groovy text-3xl text-gradient-trippy">Your Dashboard</h1>
        <Link
          href="/dispensary-signup"
          className="rounded-full border border-canopy-border px-4 py-2 text-sm font-medium hover:border-canopy-green"
        >
          + List Another Dispensary
        </Link>
      </div>

      {notice && (
        <div className="mb-6 rounded-xl border border-canopy-green/40 bg-canopy-green/10 px-4 py-3 text-sm text-canopy-green">
          {notice}
        </div>
      )}

      {dispensaries.length === 0 ? (
        <div className="rounded-2xl border border-canopy-border bg-canopy-card p-10 text-center">
          <p className="mb-4 text-canopy-muted">You don't have a dispensary storefront yet.</p>
          <Link
            href="/dispensary-signup"
            className="btn-glow inline-block rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-6 py-3 font-semibold text-black"
          >
            Create Your Storefront
          </Link>
        </div>
      ) : (
        <div className="space-y-10">
          {dispensaries.map((d) => (
            <DispensaryPanel
              key={d.id}
              dispensary={d}
              allStrains={allStrains}
              saving={savingId === d.id}
              onFieldChange={(field, value) => updateDispensaryField(d.id, field, value)}
              onSave={() => saveDispensary(d)}
              onAddProduct={(fields) => addProduct(d.id, fields)}
              onUpdateProduct={updateProduct}
              onRemoveProduct={removeProduct}
              onUpgrade={(tier) => upgrade(d.id, tier)}
              onImportMenu={(csv) => importMenu(d.id, csv)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function DispensaryPanel({
  dispensary,
  allStrains,
  saving,
  onFieldChange,
  onSave,
  onAddProduct,
  onUpdateProduct,
  onRemoveProduct,
  onUpgrade,
  onImportMenu,
}: {
  dispensary: OwnedDispensary;
  allStrains: Strain[];
  saving: boolean;
  onFieldChange: (field: keyof Dispensary, value: any) => void;
  onSave: () => void;
  onAddProduct: (fields: Partial<Product>) => void;
  onUpdateProduct: (productId: string, fields: Partial<Product>) => void;
  onRemoveProduct: (productId: string) => void;
  onUpgrade: (tier: 'pro' | 'verified') => void;
  onImportMenu: (csv: string) => Promise<any>;
}) {
  const [category, setCategory] = useState<ProductCategory>('flower');
  const [strainId, setStrainId] = useState('');
  const [name, setName] = useState('');
  const [brand, setBrand] = useState('');
  const [price, setPrice] = useState('');
  const [thc, setThc] = useState('');
  const [cbd, setCbd] = useState('');
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<any>(null);

  const handleImportFile = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    try {
      const text = await file.text();
      const result = await onImportMenu(text);
      setImportResult(result);
    } catch (err) {
      setImportResult({ error: 'Could not read that file.' });
    }
    setImporting(false);
  };

  const productsByCategory = PRODUCT_CATEGORIES.map((c) => ({
    ...c,
    items: dispensary.products.filter((p) => p.category === c.id),
  })).filter((c) => c.items.length > 0 || c.id === category);

  const resetForm = () => {
    setStrainId('');
    setName('');
    setBrand('');
    setPrice('');
    setThc('');
    setCbd('');
  };

  const handleAdd = () => {
    if (category === 'flower' && strainId) {
      const strain = allStrains.find((s) => s.id === strainId);
      onAddProduct({
        category,
        strain_id: strainId,
        name: strain?.name || name,
        price: price ? Number(price) : null,
        thc: strain?.thc ?? (thc ? Number(thc) : null),
        cbd: strain?.cbd ?? (cbd ? Number(cbd) : null),
      });
    } else {
      if (!name.trim()) return;
      onAddProduct({
        category,
        name,
        brand: brand || null,
        price: price ? Number(price) : null,
        thc: thc ? Number(thc) : null,
        cbd: cbd ? Number(cbd) : null,
      });
    }
    resetForm();
  };

  return (
    <div className="rounded-3xl border border-canopy-border bg-canopy-card p-6">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="font-groovy text-xl">{dispensary.name}</h2>
            <span className="rounded-full border border-canopy-border px-2.5 py-0.5 text-[11px] text-canopy-muted">
              {TIER_LABEL[dispensary.tier as string] || 'Free'} tier
            </span>
            {dispensary.status === 'pending' && (
              <span className="rounded-full border border-yellow-500/30 bg-yellow-500/10 px-2.5 py-0.5 text-[11px] font-medium text-yellow-400">
                Pending Verification
              </span>
            )}
          </div>
          <Link href={`/dispensaries/${dispensary.slug}`} className="text-xs text-canopy-green hover:underline">
            View public storefront →
          </Link>
        </div>
        {(dispensary.tier === 'free' || !dispensary.tier) && (
          <div className="flex gap-2">
            <button
              onClick={() => onUpgrade('pro')}
              className="rounded-full border border-canopy-border px-3 py-1.5 text-xs font-medium hover:border-canopy-green"
            >
              Upgrade to Pro
            </button>
            <button
              onClick={() => onUpgrade('verified')}
              className="btn-glow rounded-full bg-gradient-to-r from-canopy-green to-canopy-lime px-3 py-1.5 text-xs font-semibold text-black"
            >
              Upgrade to Verified
            </button>
          </div>
        )}
      </div>

      {/* Business info */}
      <div className="mb-6 grid gap-3 sm:grid-cols-2">
        <textarea
          value={dispensary.description || ''}
          onChange={(e) => onFieldChange('description', e.target.value)}
          placeholder="Description"
          rows={2}
          className="sm:col-span-2 rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
        />
        <input
          value={dispensary.address || ''}
          onChange={(e) => onFieldChange('address', e.target.value)}
          placeholder="Street address"
          className="rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
        />
        <input
          value={dispensary.phone || ''}
          onChange={(e) => onFieldChange('phone', e.target.value)}
          placeholder="Phone"
          className="rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
        />
        <input
          value={dispensary.website_url || ''}
          onChange={(e) => onFieldChange('website_url', e.target.value)}
          placeholder="Ordering site URL"
          className="rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
        />
        <input
          value={dispensary.city || ''}
          onChange={(e) => onFieldChange('city', e.target.value)}
          placeholder="City"
          className="rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
        />
        <input
          value={dispensary.state || ''}
          onChange={(e) => onFieldChange('state', e.target.value)}
          placeholder="State"
          className="rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2 text-sm focus:border-canopy-green focus:outline-none"
        />
      </div>
      <button
        onClick={onSave}
        disabled={saving}
        className="mb-8 rounded-full bg-canopy-card border border-canopy-green/40 px-4 py-2 text-xs font-semibold text-canopy-green hover:bg-canopy-green/10 disabled:opacity-50"
      >
        {saving ? 'Saving…' : 'Save Info'}
      </button>

      {/* Menu / inventory -- full catalog across every category */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-canopy-muted">
          Menu ({dispensary.products.length})
        </h3>
        <div className="flex flex-wrap items-center gap-2">
          <Link href="/cmf" className="text-xs text-canopy-green hover:underline">
            CMF-1 format guide
          </Link>
          <DownloadCmfTemplateButton className="rounded-full border border-canopy-border px-3 py-1.5 text-xs font-medium hover:border-canopy-green" />
          <label className="cursor-pointer rounded-full bg-canopy-card border border-canopy-green/40 px-3 py-1.5 text-xs font-semibold text-canopy-green hover:bg-canopy-green/10">
            {importing ? 'Importing…' : 'Import CMF-1 CSV'}
            <input
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              disabled={importing}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleImportFile(file);
                e.target.value = '';
              }}
            />
          </label>
        </div>
      </div>

      {importResult && (
        <div
          className={`mb-4 rounded-xl border px-4 py-3 text-xs ${
            importResult.error
              ? 'border-red-500/40 bg-red-500/10 text-red-300'
              : 'border-canopy-green/40 bg-canopy-green/10 text-canopy-text'
          }`}
        >
          {importResult.error ? (
            <p>{importResult.error}</p>
          ) : (
            <>
              <p className="font-medium text-canopy-green">
                Imported: {importResult.created} added, {importResult.updated} updated, {importResult.removed} removed
                (of {importResult.totalRows} rows).
              </p>
              {importResult.unmatchedSlugs?.length > 0 && (
                <p className="mt-1 text-canopy-muted">
                  No strain match for: {importResult.unmatchedSlugs.join(', ')} -- these rows imported without a
                  strain link.
                </p>
              )}
              {importResult.parseErrors?.length > 0 && (
                <ul className="mt-1 list-disc pl-4 text-canopy-muted">
                  {importResult.parseErrors.slice(0, 10).map((e: any, i: number) => (
                    <li key={i}>{e.line ? `Line ${e.line}: ` : ''}{e.message}</li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}

      <div className="mb-6 space-y-4">
        {productsByCategory
          .filter((c) => c.items.length > 0)
          .map((c) => (
            <div key={c.id}>
              <p className="mb-1.5 text-xs font-semibold text-canopy-green">{c.label}</p>
              <div className="space-y-2">
                {c.items.map((p) => (
                  <div
                    key={p.id}
                    className="flex flex-wrap items-center gap-3 rounded-xl border border-canopy-border bg-canopy-bg px-3 py-2"
                  >
                    <span className="flex-1 text-sm font-medium">
                      {p.name}
                      {p.brand ? <span className="text-canopy-muted"> · {p.brand}</span> : null}
                    </span>
                    <input
                      type="number"
                      defaultValue={p.price ?? ''}
                      onBlur={(e) => onUpdateProduct(p.id, { price: e.target.value ? Number(e.target.value) : null })}
                      placeholder="Price"
                      className="w-20 rounded-lg border border-canopy-border bg-canopy-panel px-2 py-1 text-xs"
                    />
                    <label className="flex items-center gap-1 text-xs text-canopy-muted">
                      <input
                        type="checkbox"
                        defaultChecked={p.in_stock}
                        onChange={(e) => onUpdateProduct(p.id, { in_stock: e.target.checked })}
                      />
                      In stock
                    </label>
                    <button
                      onClick={() => onRemoveProduct(p.id)}
                      className="text-xs text-red-400 hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
        {dispensary.products.length === 0 && (
          <p className="text-sm text-canopy-muted">No products yet — add your first one below.</p>
        )}
      </div>

      {/* Add product form -- any category */}
      <div className="rounded-2xl border border-canopy-border bg-canopy-bg p-4">
        <div className="mb-2 flex flex-wrap gap-2">
          {PRODUCT_CATEGORIES.map((c) => (
            <button
              key={c.id}
              onClick={() => {
                setCategory(c.id);
                resetForm();
              }}
              className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
                category === c.id
                  ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
                  : 'border-canopy-border text-canopy-muted hover:border-canopy-green'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        {category === 'flower' ? (
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={strainId}
              onChange={(e) => setStrainId(e.target.value)}
              className="rounded-xl border border-canopy-border bg-canopy-panel px-3 py-2 text-sm"
            >
              <option value="">Select a strain…</option>
              {allStrains
                .filter((s) => !dispensary.products.some((p) => p.strain_id === s.id))
                .map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
            </select>
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              className="w-24 rounded-xl border border-canopy-border bg-canopy-panel px-3 py-2 text-sm"
            />
            <button
              onClick={handleAdd}
              disabled={!strainId}
              className="rounded-full bg-canopy-green px-4 py-2 text-xs font-semibold text-black disabled:opacity-40"
            >
              Add to Menu
            </button>
          </div>
        ) : (
          <div className="grid gap-2 sm:grid-cols-2">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={`${CATEGORY_LABEL[category]} name`}
              className="rounded-xl border border-canopy-border bg-canopy-panel px-3 py-2 text-sm sm:col-span-2"
            />
            <input
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="Brand (optional)"
              className="rounded-xl border border-canopy-border bg-canopy-panel px-3 py-2 text-sm"
            />
            <input
              type="number"
              value={price}
              onChange={(e) => setPrice(e.target.value)}
              placeholder="Price"
              className="rounded-xl border border-canopy-border bg-canopy-panel px-3 py-2 text-sm"
            />
            {(category === 'concentrate' || category === 'vape' || category === 'tincture' || category === 'edible') && (
              <>
                <input
                  type="number"
                  value={thc}
                  onChange={(e) => setThc(e.target.value)}
                  placeholder="THC %"
                  className="rounded-xl border border-canopy-border bg-canopy-panel px-3 py-2 text-sm"
                />
                <input
                  type="number"
                  value={cbd}
                  onChange={(e) => setCbd(e.target.value)}
                  placeholder="CBD %"
                  className="rounded-xl border border-canopy-border bg-canopy-panel px-3 py-2 text-sm"
                />
              </>
            )}
            <button
              onClick={handleAdd}
              disabled={!name.trim()}
              className="rounded-full bg-canopy-green px-4 py-2 text-xs font-semibold text-black disabled:opacity-40 sm:col-span-2"
            >
              Add to Menu
            </button>
          </div>
        )}
      </div>

      <DemandInsights dispensaryId={dispensary.id} tier={dispensary.tier || 'free'} onUpgrade={() => onUpgrade('pro')} />
    </div>
  );
}

interface PriceTierBreakdown {
  budget: number;
  mid: number;
  premium: number;
  total: number;
}

interface PriceTierMix {
  own: PriceTierBreakdown;
  demand: PriceTierBreakdown;
  insight: string | null;
}

interface DemandData {
  locked: boolean;
  tier: string;
  sampleSize: number;
  platformWide: boolean;
  favoriteSignalCount?: number;
  topOpportunities?: {
    name: string;
    slug: string;
    type: string;
    favoriteCount: number;
    avgRating: number | null;
    reviewCount: number;
  }[];
  tasteProfile?: string[];
  priceTierMix?: PriceTierMix | null;
}

function DemandInsights({
  dispensaryId,
  tier,
  onUpgrade,
}: {
  dispensaryId: string;
  tier: string;
  onUpgrade: () => void;
}) {
  const supabase = createClient();
  const [data, setData] = useState<DemandData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const token = sessionData.session?.access_token;
      if (!token) return;
      const res = await fetch('/api/insights/demand', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: JSON.stringify({ dispensaryId }),
      });
      if (res.ok) setData(await res.json());
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dispensaryId]);

  return (
    <div className="mt-8 rounded-2xl border border-canopy-purple/30 bg-canopy-bg p-5">
      <div className="mb-1 flex items-center gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-canopy-text">Local Demand Insights</h3>
        <span className="rounded-full border border-canopy-purple/40 bg-canopy-purple/10 px-2 py-0.5 text-[10px] font-medium text-canopy-purple">
          Pro / Verified
        </span>
      </div>
      <p className="mb-4 text-xs text-canopy-muted">
        Anonymous, aggregated favorites & ratings from Canopy members — never individual data —
        showing what your area actually wants so you know what to bring in next.
      </p>

      {loading ? (
        <p className="text-sm text-canopy-muted">Crunching the numbers…</p>
      ) : !data ? (
        <p className="text-sm text-canopy-muted">Insights aren't available right now.</p>
      ) : data.locked ? (
        <div className="rounded-xl border border-canopy-border bg-canopy-card p-4">
          <p className="mb-2 text-sm text-canopy-text">
            {data.favoriteSignalCount ?? 0} strain favorites logged so far
            {data.platformWide ? ' across Canopy' : ' in your area'} — upgrade to Pro to see exactly
            which strains, sorted by demand, that you don't carry yet.
          </p>
          <button
            onClick={onUpgrade}
            className="rounded-full bg-canopy-green px-4 py-2 text-xs font-semibold text-black"
          >
            Unlock with Pro
          </button>
        </div>
      ) : (
        <div>
          <p className="mb-3 text-xs text-canopy-muted">
            Based on {data.sampleSize} Canopy member{data.sampleSize === 1 ? '' : 's'}
            {data.platformWide ? ' platform-wide (not enough local members yet to isolate your area)' : ' in your state'}.
          </p>
          {data.tasteProfile && data.tasteProfile.length > 0 && (
            <p className="mb-4 text-sm">
              <span className="text-canopy-muted">Local taste profile leans toward: </span>
              <span className="font-medium text-canopy-green">{data.tasteProfile.join(', ')}</span>
            </p>
          )}
          {!data.topOpportunities || data.topOpportunities.length === 0 ? (
            <p className="text-sm text-canopy-muted">
              No clear gaps right now — your menu already covers what members are favoriting.
            </p>
          ) : (
            <div className="space-y-2">
              {data.topOpportunities.map((o) => (
                <div
                  key={o.slug}
                  className="flex items-center justify-between rounded-xl border border-canopy-border bg-canopy-card px-3 py-2 text-sm"
                >
                  <div>
                    <span className="font-medium">{o.name}</span>
                    <span className="ml-2 text-xs text-canopy-muted">{o.type}</span>
                  </div>
                  <div className="text-xs text-canopy-muted">
                    {o.favoriteCount} favorites{o.avgRating ? ` · ★ ${o.avgRating}` : ''}
                  </div>
                </div>
              ))}
            </div>
          )}

          {data.priceTierMix && data.priceTierMix.own.total > 0 && (
            <PriceTierMixPanel mix={data.priceTierMix} />
          )}
        </div>
      )}
    </div>
  );
}

function PriceTierMixPanel({ mix }: { mix: PriceTierMix }) {
  const rows: { label: string; key: keyof PriceTierBreakdown }[] = [
    { label: 'Budget (<$30)', key: 'budget' },
    { label: 'Mid ($30–$55)', key: 'mid' },
    { label: 'Premium (>$55)', key: 'premium' },
  ];

  return (
    <div className="mt-5 rounded-xl border border-canopy-border bg-canopy-card p-4">
      <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-canopy-muted">
        Price-Tier Mix: Your Menu vs. Local Demand
      </h4>
      <p className="mb-3 text-[11px] text-canopy-muted">
        "Demand" prices what members are favoriting using each strain's platform-wide average
        listed price — so it reflects what people want, not what you happen to charge.
      </p>
      <div className="space-y-2">
        {rows.map((r) => (
          <div key={r.key} className="text-xs">
            <div className="mb-1 flex items-center justify-between text-canopy-muted">
              <span>{r.label}</span>
              <span>
                You {mix.own[r.key]}% · Demand {mix.demand.total > 0 ? `${mix.demand[r.key]}%` : '—'}
              </span>
            </div>
            <div className="flex gap-1">
              <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canopy-bg">
                <div className="h-full bg-canopy-green" style={{ width: `${mix.own[r.key]}%` }} />
              </div>
              {mix.demand.total > 0 && (
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-canopy-bg">
                  <div className="h-full bg-canopy-purple" style={{ width: `${mix.demand[r.key]}%` }} />
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
      {mix.insight && (
        <p className="mt-3 rounded-lg border border-yellow-500/30 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-200">
          {mix.insight}
        </p>
      )}
    </div>
  );
}
