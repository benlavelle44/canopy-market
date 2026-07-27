import { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/siteConfig';

// Everything a shopper can browse is fair game for crawlers -- everything
// behind a login (dashboard, account, admin) or a raw API route is not.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: ['/dashboard', '/account', '/admin', '/api'],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
