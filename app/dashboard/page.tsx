import { Suspense } from 'react';
import DashboardClient from './DashboardClient';

export default function DashboardPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-5xl px-4 py-20 text-center text-canopy-muted">Loading…</div>}>
      <DashboardClient />
    </Suspense>
  );
}
