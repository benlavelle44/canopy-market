import type { Metadata } from 'next';
import './globals.css';
import NavBar from '@/components/NavBar';
import Footer from '@/components/Footer';
import AgeGate from '@/components/AgeGate';
import TrippyBackground from '@/components/TrippyBackground';

export const metadata: Metadata = {
  title: 'Canopy Market — Find Your Strain, Shop Local Dispensaries',
  description:
    'AI-powered cannabis strain finder and dispensary marketplace. Describe how you want to feel, get matched to strains, and order from licensed dispensaries near you.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-canopy-bg font-sans text-canopy-text">
        <TrippyBackground />
        <AgeGate />
        <NavBar />
        <main className="min-h-[70vh]">{children}</main>
        <Footer />
      </body>
    </html>
  );
}
