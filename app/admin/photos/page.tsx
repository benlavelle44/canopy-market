import { Suspense } from 'react';
import AdminPhotosClient from './AdminPhotosClient';

export const metadata = {
  title: 'Grow Photo Review Queue — Canopy Market',
};

export default function AdminPhotosPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-20 text-center text-canopy-muted">Loading…</div>}>
      <AdminPhotosClient />
    </Suspense>
  );
}
