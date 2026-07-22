'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabaseClient';
import { Strain } from '@/lib/types';
import StrainCard from '@/components/StrainCard';

export default function FavoritesPage() {
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [signedIn, setSignedIn] = useState(true);
  const [strains, setStrains] = useState<Strain[]>([]);

  useEffect(() => {
    (async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const uid = sessionData.session?.user?.id;
      if (!uid) {
        setSignedIn(false);
        setLoading(false);
        return;
      }
      const { data } = await supabase
        .from('favorites')
        .select('strains(*)')
        .eq('user_id', uid);
      const list = (data || []).map((row: any) => row.strains).filter(Boolean);
      setStrains(list);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (loading) {
    return <div className="mx-auto max-w-6xl px-4 py-20 text-center text-canopy-muted">Loading…</div>;
  }

  if (!signedIn) {
    return (
      <div className="mx-auto max-w-md px-4 py-20 text-center">
        <h1 className="mb-2 text-2xl font-bold">Sign in to see your favorites</h1>
        <Link href="/login" className="text-canopy-green hover:underline">
          Sign in →
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-10">
      <h1 className="mb-6 text-3xl font-bold">Your Favorites</h1>
      {strains.length === 0 ? (
        <p className="text-canopy-muted">
          You haven't saved any strains yet.{' '}
          <Link href="/strains" className="text-canopy-green hover:underline">
            Browse strains →
          </Link>
        </p>
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
