'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

const FREE_FAVORITE_LIMIT = 10;

export default function FavoriteButton({ strainId }: { strainId: string }) {
  const supabase = createClient();
  const router = useRouter();
  const [userId, setUserId] = useState<string | null>(null);
  const [isFavorite, setIsFavorite] = useState(false);
  const [loading, setLoading] = useState(false);
  const [memberTier, setMemberTier] = useState<'free' | 'plus'>('free');
  const [favoriteCount, setFavoriteCount] = useState(0);
  const [limitNotice, setLimitNotice] = useState('');

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      const uid = data.session?.user?.id ?? null;
      setUserId(uid);
      if (uid) {
        const [{ data: fav }, { data: profile }, { count }] = await Promise.all([
          supabase.from('favorites').select('id').eq('user_id', uid).eq('strain_id', strainId).maybeSingle(),
          supabase.from('profiles').select('member_tier').eq('id', uid).maybeSingle(),
          supabase.from('favorites').select('id', { count: 'exact', head: true }).eq('user_id', uid),
        ]);
        setIsFavorite(!!fav);
        setMemberTier((profile as any)?.member_tier === 'plus' ? 'plus' : 'free');
        setFavoriteCount(count || 0);
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [strainId]);

  const toggle = async () => {
    if (!userId) {
      router.push('/login');
      return;
    }
    setLimitNotice('');
    if (!isFavorite && memberTier === 'free' && favoriteCount >= FREE_FAVORITE_LIMIT) {
      setLimitNotice(`Free accounts can save up to ${FREE_FAVORITE_LIMIT} favorites. Upgrade to Canopy+ for unlimited.`);
      return;
    }
    setLoading(true);
    if (isFavorite) {
      await supabase.from('favorites').delete().eq('user_id', userId).eq('strain_id', strainId);
      setIsFavorite(false);
      setFavoriteCount((c) => Math.max(0, c - 1));
    } else {
      await supabase.from('favorites').insert({ user_id: userId, strain_id: strainId });
      setIsFavorite(true);
      setFavoriteCount((c) => c + 1);
    }
    setLoading(false);
  };

  return (
    <div>
      <button
        onClick={toggle}
        disabled={loading}
        className={`rounded-full border px-4 py-2 text-sm font-medium transition ${
          isFavorite
            ? 'border-canopy-green bg-canopy-green/15 text-canopy-green'
            : 'border-canopy-border text-canopy-muted hover:border-canopy-green hover:text-canopy-green'
        }`}
      >
        {isFavorite ? '♥ Saved' : '♡ Save'}
      </button>
      {limitNotice && (
        <p className="mt-2 text-xs text-canopy-muted">
          {limitNotice}{' '}
          <a href="/pricing" className="text-canopy-green hover:underline">
            See Canopy+
          </a>
        </p>
      )}
    </div>
  );
}
