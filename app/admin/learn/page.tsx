import { Suspense } from 'react';
import AdminLearnClient from './AdminLearnClient';

export const metadata = {
  title: 'Learn Article Review — Canopy Market',
};

export default function AdminLearnPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-20 text-center text-canopy-muted">Loading…</div>}>
      <AdminLearnClient />
    </Suspense>
  );
}
