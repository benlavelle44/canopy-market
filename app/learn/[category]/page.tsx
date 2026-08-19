import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { LearnArticle, LearnCategory, LEARN_CATEGORY_LABELS } from '@/lib/types';
import { SITE_URL } from '@/lib/siteConfig';

export const revalidate = 3600;

const VALID_CATEGORIES = Object.keys(LEARN_CATEGORY_LABELS) as LearnCategory[];

async function getCategoryArticles(category: string): Promise<LearnArticle[]> {
  const supabase = createServerReadClient();
  const { data } = await supabase
    .from('learn_articles')
    .select('*')
    .eq('category', category)
    .eq('status', 'published')
    .order('published_at', { ascending: false });
  return (data || []) as LearnArticle[];
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string }>;
}): Promise<Metadata> {
  const { category } = await params;
  if (!VALID_CATEGORIES.includes(category as LearnCategory)) return { title: 'Learn — Canopy Market' };
  const label = LEARN_CATEGORY_LABELS[category as LearnCategory];
  return {
    title: `${label} — Learn — Canopy Market`,
    description: `Cannabis education on ${label.toLowerCase()}, taught by Kief, Canopy's AI budtender.`,
    alternates: { canonical: `${SITE_URL}/learn/${category}` },
  };
}

export default async function LearnCategoryPage({ params }: { params: Promise<{ category: string }> }) {
  const { category } = await params;
  if (!VALID_CATEGORIES.includes(category as LearnCategory)) notFound();
  const cat = category as LearnCategory;
  const articles = await getCategoryArticles(cat);

  return (
    <div className="mx-auto max-w-3xl px-4 py-14">
      <Link href="/learn" className="mb-6 inline-block text-xs text-canopy-green hover:underline">
        ← All of Learn
      </Link>
      <h1 className="mb-3 font-groovy text-3xl text-gradient-trippy">{LEARN_CATEGORY_LABELS[cat]}</h1>

      {articles.length === 0 ? (
        <p className="text-canopy-muted">More on this topic is coming soon.</p>
      ) : (
        <div className="space-y-3">
          {articles.map((a) => (
            <Link
              key={a.id}
              href={`/learn/${a.category}/${a.slug}`}
              className="card-glow-hover block rounded-2xl border border-canopy-border bg-canopy-panel p-5"
            >
              <h2 className="mb-1.5 font-semibold">{a.title}</h2>
              <p className="text-sm text-canopy-muted">{a.description}</p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
