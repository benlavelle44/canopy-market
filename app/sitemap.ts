import { MetadataRoute } from 'next';
import { createServerReadClient } from '@/lib/supabaseServer';
import { SITE_URL } from '@/lib/siteConfig';

// Every strain and every approved dispensary gets its own indexable URL --
// this is the whole reason organic search can ever find this app. Static
// marketing/info pages are listed too, but the dynamic catalog is the part
// that actually matters for an "Amazon of cannabis" growth story.
export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const supabase = createServerReadClient();

  const [{ data: strains }, { data: dispensaries }] = await Promise.all([
    supabase.from('strains').select('slug, created_at').eq('verification_status', 'verified'),
    supabase.from('dispensaries').select('slug, created_at').eq('status', 'approved'),
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

  return [...staticPages, ...strainPages, ...dispensaryPages];
}
