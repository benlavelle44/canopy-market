import { Suspense } from 'react';
import { createServerReadClient } from '@/lib/supabaseServer';
import { Strain } from '@/lib/types';
import StrainCard from '@/components/StrainCard';
import StrainFilters from './StrainFilters';

export const revalidate = 0;

async function getStrains(searchParams: { [key: string]: string | string[] | undefined }) {
  const supabase = createServerReadClient();
  let query = supabase.from('strains').select('*').order('rating', { ascending: false });

  const q = typeof searchParams.q === 'string' ? searchParams.q : '';
  const type = typeof searchParams.type === 'string' ? searchParams.type : '';
  const symptom = typeof searchParams.symptom === 'string' ? searchParams.symptom : '';

  if (q) query = query.ilike('name', `%${q}%`);
  if (type) query = query.eq('type', type);
  if (symptom) query = query.contains('symptoms', [symptom]);

  const { data } = await query;
  return (data || []) as Strain[];
}

export default async function StrainsPage({
  searchParams,
}: {
  searchParams: { [key: string]: string | string[] | undefined };
}) {
  const strains = await getStrains(searchParams);

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Browse Strains</h1>
      <Suspense fallback={null}>
        <StrainFilters />
      </Suspense>

      <p className="mb-4 text-sm text-canopy-muted">{strains.length} strains found</p>

      {strains.length === 0 ? (
        <p className="text-canopy-muted">No strains match those filters. Try broadening your search.</p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {strains.map((s) => (
            <StrainCard key={s.id} strain={s} />
          ))}
        </div>
      )}
    </div>
  );
}
