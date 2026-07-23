import { Suspense } from 'react';
import { createServerReadClient } from '@/lib/supabaseServer';
import { Strain } from '@/lib/types';
import { findSimilarNames } from '@/lib/fuzzy';
import StrainCard from '@/components/StrainCard';
import StrainFilters from './StrainFilters';
import StrainFinder from '@/components/StrainFinder';

export const revalidate = 0;

async function getStrains(searchParams: { [key: string]: string | string[] | undefined }) {
  const supabase = createServerReadClient();
  // Only strains that have cleared review show up in browse/search --
  // community finds sit as "pending" until an admin verifies them, though
  // the person who added one can still open it directly by its own link.
  let query = supabase.from('strains').select('*').eq('verification_status', 'verified').order('rating', { ascending: false });

  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const type = typeof searchParams.type === 'string' ? searchParams.type : '';
  const symptom = typeof searchParams.symptom === 'string' ? searchParams.symptom : '';

  if (q) query = query.ilike('name', `%${q}%`);
  if (type) query = query.eq('type', type);
  if (symptom) query = query.contains('symptoms', [symptom]);

  const { data } = await query;
  return (data || []) as Strain[];
}

// For "did you mean" suggestions we need the full name list to compare
// against, independent of whatever filters narrowed the zero-result query.
async function getAllNames() {
  const supabase = createServerReadClient();
  const { data } = await supabase
    .from('strains')
    .select('slug, name')
    .eq('verification_status', 'verified');
  return (data || []) as { slug: string; name: string }[];
}

export default async function StrainsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const strains = await getStrains(searchParams);
  const q = typeof searchParams.q === 'string' ? searchParams.q.trim() : '';

  let suggestions: { slug: string; name: string }[] = [];
  if (strains.length === 0 && q) {
    const allNames = await getAllNames();
    suggestions = findSimilarNames(q, allNames, (n) => n.name).map((m) => m.item);
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Browse Strains</h1>
      <Suspense fallback={null}>
        <StrainFilters />
      </Suspense>

      <p className="mb-4 text-sm text-canopy-muted">{strains.length} strains found</p>

      {strains.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-canopy-border/70 bg-canopy-bg/40 px-6 py-10 text-center">
          <p className="text-canopy-muted">Nothing in the catalog matches those filters yet.</p>
        </div>
      ) : null}

      {strains.length === 0 && q && (
        <Suspense fallback={null}>
          <StrainFinder query={q} suggestions={suggestions} />
        </Suspense>
      )}

      {strains.length > 0 && (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {strains.map((s) => (
            <StrainCard key={s.id} strain={s} />
          ))}
        </div>
      )}
    </div>
  );
}
