import Link from 'next/link';
import Image from 'next/image';
import type { Metadata } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { LearnArticle, LearnCategory, LEARN_CATEGORY_LABELS } from '@/lib/types';
import { SITE_URL } from '@/lib/siteConfig';

export const revalidate = 3600;

export const metadata: Metadata = {
  title: "Learn — Canopy Market",
  description:
    'Cannabis education taught by Kief, Canopy\'s AI budtender -- strains, terpenes, consumption methods, dosing, and more.',
  alternates: { canonical: `${SITE_URL}/learn` },
};

const CATEGORY_ORDER: LearnCategory[] = ['basics', 'products', 'body', 'plant', 'dosing-safety', 'dictionary', 'laws'];

async function getArticles(): Promise<LearnArticle[]> {
  const supabase = createServerReadClient();
  const { data } = await supabase
    .from('learn_articles')
    .select('*')
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  return (data || []) as LearnArticle[];
}

export default async function LearnHubPage() {
  const articles = await getArticles();
  const featured = articles.filter((a) => a.featured).slice(0, 4);
  const byCategory = CATEGORY_ORDER.map((cat) => ({
    category: cat,
    articles: articles.filter((a) => a.category === cat),
  })).filter((g) => g.articles.length > 0);

  return (
    <div className="mx-auto max-w-5xl px-4 py-14">
      <div className="mb-10 flex flex-col items-center gap-4 text-center">
        <Image
          src="/kief/kief-teacher.png"
          alt="Kief"
          width={96}
          height={70}
          className="h-20 w-auto drop-shadow-[0_0_16px_rgba(57,255,106,0.35)]"
        />
        <div>
          <h1 className="font-groovy text-4xl text-gradient-trippy">Learn, Taught by Kief</h1>
          <p className="mx-auto mt-3 max-w-xl text-canopy-muted">
            Real cannabis education from Canopy&apos;s AI budtender -- strains, terpenes, consumption
            methods, dosing, and the vocabulary that comes with all of it. No fluff, no filler.
          </p>
        </div>
      </div>

      <nav className="mb-12 flex flex-wrap justify-center gap-2">
        {CATEGORY_ORDER.map((cat) => (
          <Link
            key={cat}
            href={`/learn/${cat}`}
            className="rounded-full border border-canopy-border px-3 py-1.5 text-xs text-canopy-muted transition hover:border-canopy-green hover:text-canopy-green"
          >
            {LEARN_CATEGORY_LABELS[cat]}
          </Link>
        ))}
      </nav>

      {featured.length > 0 && (
        <div className="mb-14">
          <h2 className="mb-4 font-groovy text-xl">Start here</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {featured.map((a) => (
              <Link
                key={a.id}
                href={`/learn/${a.category}/${a.slug}`}
                className="card-glow-hover rounded-2xl border border-canopy-border bg-canopy-panel p-5"
              >
                <span className="mb-2 inline-block rounded-full border border-canopy-green/40 px-2 py-0.5 text-[10px] font-semibold text-canopy-green">
                  {LEARN_CATEGORY_LABELS[a.category]}
                </span>
                <h3 className="mb-1.5 font-semibold">{a.title}</h3>
                <p className="text-sm text-canopy-muted">{a.description}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      <div className="space-y-12">
        {byCategory.map((group) => (
          <section key={group.category}>
            <div className="mb-4 flex items-center justify-between">
              <h2 className="font-groovy text-xl">{LEARN_CATEGORY_LABELS[group.category]}</h2>
              <Link href={`/learn/${group.category}`} className="text-xs text-canopy-green hover:underline">
                View all →
              </Link>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {group.articles.map((a) => (
                <Link
                  key={a.id}
                  href={`/learn/${a.category}/${a.slug}`}
                  className="rounded-xl border border-canopy-border bg-canopy-card px-4 py-3 text-sm transition hover:border-canopy-green/50"
                >
                  <span className="font-medium">{a.title}</span>
                </Link>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
