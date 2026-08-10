import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AgeGate from '@/components/AgeGate';
import StateGate from '@/components/StateGate';
import TrippyBackground from '@/components/TrippyBackground';
import { SITE_URL } from '@/lib/siteConfig';

const TITLE = 'Canopy Market — Find Your Strain, Shop Local Dispensaries';
const DESCRIPTION =
  'AI-powered cannabis strain finder and dispensary marketplace. Describe how you want to feel, get matched to strains, and order from licensed dispensaries near you.';

// Sets the fallback share-card/search-result appearance for every page that
// doesn't define its own metadata -- strain and dispensary pages override
// this with their own title/description/image via generateMetadata().
export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: TITLE, template: '%s | Canopy Market' },
  description: DESCRIPTION,
  openGraph: {
    title: TITLE,
    description: DESCRIPTION,
    url: SITE_URL,
    siteName: 'Canopy Market',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: TITLE,
    description: DESCRIPTION,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canopy-bg font-sans text-canopy-text">
        <TrippyBackground />
        <AgeGate />
        <StateGate />
        <NavBar />
        <main className="min-h-[70vh]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
