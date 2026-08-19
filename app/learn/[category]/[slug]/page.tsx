import Link from 'next/link';
import Image from 'next/image';
import { cache } from 'react';
import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { LearnArticle, LearnBlock, LEARN_CATEGORY_LABELS } from '@/lib/types';
import { SITE_URL } from '@/lib/siteConfig';

export const revalidate = 3600;

const getArticle = cache(async (category: string, slug: string) => {
  const supabase = createServerReadClient();
  const { data: article } = await supabase
    .from('learn_articles')
    .select('*')
    .eq('category', category)
    .eq('slug', slug)
    .eq('status', 'published')
    .maybeSingle();
  if (!article) return null;

  const { data: related } = await supabase
    .from('learn_articles')
    .select('id, slug, category, title, description')
    .eq('category', category)
    .eq('status', 'published')
    .neq('slug', slug)
    .limit(3);

  return { article: article as LearnArticle, related: (related || []) as Pick<LearnArticle, 'id' | 'slug' | 'category' | 'title' | 'description'>[] };
});

export async function generateMetadata({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}): Promise<Metadata> {
  const { category, slug } = await params;
  const result = await getArticle(category, slug);
  if (!result) return { title: 'Article not found — Canopy Market' };
  const { article } = result;
  return {
    title: `${article.title} — Canopy Market Learn`,
    description: article.description,
    alternates: { canonical: `${SITE_URL}/learn/${article.category}/${article.slug}` },
    openGraph: {
      title: article.title,
      description: article.description,
      type: 'article',
    },
  };
}

function Block({ block }: { block: LearnBlock }) {
  if (block.type === 'h2') {
    return <h2 className="mb-3 mt-8 font-groovy text-xl">{block.text}</h2>;
  }
  if (block.type === 'list') {
    return (
      <ul className="mb-4 space-y-2 text-canopy-muted">
        {block.items.map((item, i) => (
          <li key={i} className="flex gap-2">
            <span className="mt-2 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-canopy-green" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.type === 'term') {
    return (
      <div className="mb-3 rounded-xl border border-canopy-border bg-canopy-card px-4 py-3">
        <span className="font-semibold text-canopy-text">{block.term}</span>
        <span className="text-canopy-muted"> — {block.definition}</span>
      </div>
    );
  }
  return <p className="mb-4 leading-relaxed text-canopy-muted">{block.text}</p>;
}

export default async function LearnArticlePage({
  params,
}: {
  params: Promise<{ category: string; slug: string }>;
}) {
  const { category, slug } = await params;
  const result = await getArticle(category, slug);
  if (!result) notFound();
  const { article, related } = result;

  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: article.title,
    description: article.description,
    datePublished: article.published_at,
    author: { '@type': 'Organization', name: 'Canopy Market' },
    publisher: { '@type': 'Organization', name: 'Canopy Market' },
    mainEntityOfPage: `${SITE_URL}/learn/${article.category}/${article.slug}`,
  };

  return (
    <div className="mx-auto max-w-2xl px-4 py-14">
      {/* eslint-disable-next-line react/no-danger */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      <Link href={`/learn/${article.category}`} className="mb-6 inline-block text-xs text-canopy-green hover:underline">
        ← {LEARN_CATEGORY_LABELS[article.category]}
      </Link>

      <h1 className="mb-6 font-groovy text-3xl leading-tight text-gradient-trippy">{article.title}</h1>

      <div className="mb-8 flex items-start gap-3 rounded-2xl border border-canopy-green/30 bg-canopy-green/5 p-4">
        <Image
          src="/kief/kief-icon.png"
          alt="Kief"
          width={40}
          height={40}
          className="h-10 w-10 flex-shrink-0 rounded-full"
        />
        <p className="text-sm text-canopy-text">{article.kief_intro}</p>
      </div>

      <div>
        {article.body.map((block, i) => (
          <Block key={i} block={block} />
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-canopy-border bg-canopy-panel p-5 text-center">
        <p className="mb-3 text-sm text-canopy-muted">Have a more specific question? Kief will actually answer it.</p>
        <Link
          href="/assistant"
          className="btn-glow inline-block rounded-full bg-gradient-to-r from-canopy-green via-canopy-lime to-canopy-green px-5 py-2 text-sm font-semibold text-black"
        >
          Ask Kief →
        </Link>
      </div>

      {related.length > 0 && (
        <div className="mt-12">
          <h2 className="mb-4 font-groovy text-lg">More on {LEARN_CATEGORY_LABELS[article.category].toLowerCase()}</h2>
          <div className="space-y-3">
            {related.map((r) => (
              <Link
                key={r.id}
                href={`/learn/${r.category}/${r.slug}`}
                className="block rounded-xl border border-canopy-border bg-canopy-card px-4 py-3 text-sm transition hover:border-canopy-green/50"
              >
                <span className="font-medium">{r.title}</span>
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
