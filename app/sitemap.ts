import { MetadataRoute } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { SITE_URL } from '@/lib/siteConfig';
import { LEARN_CATEGORY_LABELS } from '@/lib/types';

// Every strain and every approved dispensary gets its own indexable URL --
// this is the whole reason organic search can ever find this app. Static
// marketing/info pages are listed too, but the dynamic catalog is the part
// that actually matters for an "Amazon of cannabis" growth story.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerReadClient();

  const [{ data: strains }, { data: dispensaries }, { data: learnArticles }] = await Promise.all([
    supabase.from('strains').select('slug, created_at').eq('verification_status', 'verified'),
    supabase.from('dispensaries').select('slug, created_at').eq('status', 'approved'),
    supabase.from('learn_articles').select('slug, category, published_at'),
  ]);

  const staticPages: MetadataRoute.Sitemap = [
    { url: SITE_URL, changeFrequency: 'daily', priority: 1 },
    { url: `${SITE_URL}/strains`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/dispensaries`, changeFrequency: 'daily', priority: 0.9 },
    { url: `${SITE_URL}/shop`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/deals`, changeFrequency: 'daily', priority: 0.8 },
    { url: `${SITE_URL}/learn`, changeFrequency: 'weekly', priority: 0.6 },
    { url: `${SITE_URL}/legal`, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/pricing`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/dispensary-signup`, changeFrequency: 'monthly', priority: 0.5 },
    { url: `${SITE_URL}/community`, changeFrequency: 'weekly', priority: 0.4 },
    { url: `${SITE_URL}/insights`, changeFrequency: 'weekly', priority: 0.4 },
  ];

  const strainPages: MetadataRoute.Sitemap = (strains || []).map((s: any) => ({
    url: `${SITE_URL}/strains/${s.slug}`,
    lastModified: s.created_at ? new Date(s.created_at) : undefined,
    changeFrequency: 'weekly',
    priority: 0.7,
  }));

  const dispensaryPages: MetadataRoute.Sitemap = (dispensaries || []).map((d: any) => ({
    url: `${SITE_URL}/dispensaries/${d.slug}`,
    lastModified: d.created_at ? new Date(d.created_at) : undefined,
    changeFrequency: 'daily',
    priority: 0.7,
  }));

  // Every Learn category and every article gets its own indexable URL --
  // this section is the site's main organic-search growth lever (SEO
  // long-tail content), same role the strain/dispensary pages play for
  // transactional search.
  const learnCategoryPages: MetadataRoute.Sitemap = Object.keys(LEARN_CATEGORY_LABELS).map((cat) => ({
    url: `${SITE_URL}/learn/${cat}`,
    changeFrequency: 'weekly',
    priority: 0.5,
  }));

  const learnArticlePages: MetadataRoute.Sitemap = (learnArticles || []).map((a: any) => ({
    url: `${SITE_URL}/learn/${a.category}/${a.slug}`,
    lastModified: a.published_at ? new Date(a.published_at) : undefined,
    changeFrequency: 'monthly',
    priority: 0.6,
  }));

  return [...staticPages, ...strainPages, ...dispensaryPages, ...learnCategoryPages, ...learnArticlePages];
}
