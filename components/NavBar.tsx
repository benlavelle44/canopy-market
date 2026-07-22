'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const links = [
    { href: '/shop', label: 'Shop' },
    { href: '/strains', label: 'Strains' },
    { href: '/dispensaries', label: 'Dispensaries' },
    { href: '/assistant', label: 'AI Budtender' },
    { href: '/community', label: 'Community' },
    { href: '/learn', label: 'Learn' },
    { href: '/insights', label: 'Insights' },
    { href: '/legal', label: 'Legal' },
  ];

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/');
    router.refresh();
  };

  return (
    <header className="sticky top-0 z-50 border-b border-canopy-border bg-canopy-bg/80 backdrop-blur-lg">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
        <Link href="/" className="flex items-center gap-2 text-lg font-groovy">
          <span className="text-2xl drop-shadow-[0_0_10px_rgba(57,255,106,0.8)]">🌿</span>
          <span className="text-gradient-trippy">Canopy Market</span>
        </Link>

        <nav className="hidden items-center gap-4 text-sm text-canopy-muted lg:flex">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="transition hover:text-canopy-text">
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          <Link
            href="/pricing"
            className="text-sm text-canopy-muted hover:text-canopy-text"
          >
            Pricing
          </Link>
          <Link
            href="/dispensary-signup"
            className="rounded-full border border-canopy-border px-4 py-2 text-sm font-medium text-canopy-text transition hover:border-canopy-green"
          >
            List Your Dispensary
          </Link>
          {email ? (
            <>
              <Link href="/dashboard" className="text-sm text-canopy-muted hover:text-canopy-text">
                Dashboard
              </Link>
              <Link href="/favorites" className="text-sm text-canopy-muted hover:text-canopy-text">
                Favorites
              </Link>
              <Link href="/account" className="text-sm text-canopy-muted hover:text-canopy-text">
                {email.split('@')[0]}
              </Link>
              <button
                onClick={handleSignOut}
                className="rounded-full bg-canopy-card px-4 py-2 text-sm font-medium text-canopy-text hover:bg-canopy-border"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/login"
              className="btn-glow rounded-full bg-gradient-to-r from-canopy-green to-canopy-lime px-4 py-2 text-sm font-semibold text-black"
            >
              Sign in
            </Link>
          )}
        </div>

        <button className="text-2xl lg:hidden" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
          ☰
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-canopy-border px-4 pb-4 lg:hidden">
          <nav className="flex flex-col gap-3 pt-3 text-sm">
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-canopy-muted">
                {l.label}
              </Link>
            ))}
            <Link href="/pricing" className="text-canopy-muted">
              Pricing
            </Link>
            <Link href="/dispensary-signup" className="text-canopy-muted">
              List Your Dispensary
            </Link>
            {email ? (
              <>
                <Link href="/dashboard" className="text-canopy-muted">
                  Dashboard
                </Link>
                <Link href="/favorites" className="text-canopy-muted">
                  Favorites
                </Link>
                <Link href="/account" className="text-canopy-muted">
                  Account
                </Link>
                <button onClick={handleSignOut} className="text-left text-canopy-muted">
                  Sign out
                </button>
              </>
            ) : (
              <Link href="/login" className="text-canopy-green">
                Sign in
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}
