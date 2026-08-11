'use client';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabaseClient';
import NotificationBell from '@/components/NotificationBell';

export default function NavBar() {
  const [email, setEmail] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [hasDispensary, setHasDispensary] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const [shopperState, setShopperState] = useState<string | null>(null);
  const moreRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setEmail(data.session?.user?.email ?? null);
      setUserId(data.session?.user?.id ?? null);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setEmail(session?.user?.email ?? null);
      setUserId(session?.user?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  // Determines the single "your stuff" destination in the nav -- a shopper
  // sees My Dashboard (/account), a dispensary owner sees My Dispensary
  // (/dashboard). Never both at once; each page already cross-links to the
  // other when relevant (account has a "Manage Your Dispensary" link, and
  // the dashboard links back to /account) so nothing is actually hidden.
  useEffect(() => {
    if (!userId) {
      setHasDispensary(false);
      return;
    }
    supabase
      .from('dispensaries')
      .select('id')
      .eq('owner_id', userId)
      .limit(1)
      .then(({ data }) => setHasDispensary((data || []).length > 0));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  useEffect(() => {
    setMenuOpen(false);
    setMoreOpen(false);
  }, [pathname]);

  // Reads the same canopy_state cookie the StateGate/server pages read, so
  // the nav can show which state's listings the shopper is currently
  // scoped to and offer a one-click way to change it.
  useEffect(() => {
    const match = document.cookie.match(/(?:^|; )canopy_state=([^;]*)/);
    setShopperState(match ? decodeURIComponent(match[1]) : null);
  }, [pathname]);

  const changeState = () => {
    document.cookie = 'canopy_state=; path=/; max-age=0';
    window.location.reload();
  };

  // Close the "More" dropdown on an outside click, same pattern as
  // NotificationBell.
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (moreRef.current && !moreRef.current.contains(e.target as Node)) {
        setMoreOpen(false);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  // CMF-1 Spec intentionally isn't a top-level link -- it's a menu-feed
  // integration doc for dispensary owners, not something a shopper needs to
  // see. It's already linked contextually from the dashboard's CSV import
  // section.
  //
  // The bar was crammed with 10 flat links plus 3-4 account controls, which
  // is what made it feel like a mess at a glance. Splitting into "primary"
  // (the shopping-flow links people actually click most) and "more"
  // (informational/secondary links, tucked into a dropdown) cuts the visible
  // top-level count from 10 to 5 without removing anything.
  const primaryLinks = [
    { href: '/shop', label: 'Shop' },
    { href: '/deals', label: 'Deals' },
    { href: '/strains', label: 'Strains' },
    { href: '/dispensaries', label: 'Dispensaries' },
    { href: '/assistant', label: 'Ask Kief' },
  ];
  const moreLinks = [
    { href: '/community', label: 'Community' },
    { href: '/learn', label: 'Learn' },
    { href: '/insights', label: 'Insights' },
    { href: '/merch', label: 'Merch' },
    { href: '/pricing', label: 'Pricing' },
    { href: '/legal', label: 'Legal' },
  ];
  const links = [...primaryLinks, ...moreLinks];

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
          {primaryLinks.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1.5 transition hover:text-canopy-text"
            >
              {l.href === '/assistant' && (
                <Image src="/kief/kief-icon.png" alt="" width={20} height={20} className="rounded-full" />
              )}
              {l.label}
            </Link>
          ))}
          <div className="relative" ref={moreRef}>
            <button
              onClick={() => setMoreOpen((v) => !v)}
              className="flex items-center gap-1 transition hover:text-canopy-text"
              aria-expanded={moreOpen}
            >
              More
              <span className={`text-[10px] transition-transform ${moreOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            {moreOpen && (
              <div className="absolute right-0 top-full mt-2 w-44 rounded-xl border border-canopy-border bg-canopy-card p-1.5 shadow-xl">
                {moreLinks.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    className="block rounded-lg px-3 py-2 text-sm text-canopy-muted transition hover:bg-canopy-bg hover:text-canopy-text"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </nav>

        <div className="hidden items-center gap-3 lg:flex">
          {shopperState && (
            <button
              onClick={changeState}
              title="Change your state"
              className="rounded-full border border-canopy-border px-3 py-1.5 text-xs font-medium text-canopy-muted transition hover:border-canopy-green hover:text-canopy-text"
            >
              📍 {shopperState}
            </button>
          )}
          <Link
            href="/dispensary-signup"
            className="rounded-full border border-canopy-border px-4 py-2 text-sm font-medium text-canopy-text transition hover:border-canopy-green"
          >
            List Your Dispensary
          </Link>
          {email ? (
            <>
              {userId && <NotificationBell userId={userId} />}
              {hasDispensary ? (
                <Link href="/dashboard" className="text-sm text-canopy-muted hover:text-canopy-text">
                  My Dispensary
                </Link>
              ) : (
                <Link href="/account" className="text-sm text-canopy-muted hover:text-canopy-text">
                  My Dashboard
                </Link>
              )}
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
            {shopperState && (
              <button onClick={changeState} className="text-left text-canopy-muted">
                📍 Shopping in {shopperState} — change
              </button>
            )}
            {links.map((l) => (
              <Link key={l.href} href={l.href} className="text-canopy-muted">
                {l.label}
              </Link>
            ))}
            <Link href="/dispensary-signup" className="text-canopy-muted">
              List Your Dispensary
            </Link>
            {email ? (
              <>
                {userId && (
                  <div className="flex items-center gap-2 text-canopy-muted">
                    <span>Notifications</span>
                    <NotificationBell userId={userId} />
                  </div>
                )}
                {hasDispensary ? (
                  <Link href="/dashboard" className="text-canopy-muted">
                    My Dispensary
                  </Link>
                ) : (
                  <Link href="/account" className="text-canopy-muted">
                    My Dashboard
                  </Link>
                )}
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
