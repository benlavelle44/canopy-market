import { Suspense } from 'react';
import AdminStrainsClient from './AdminStrainsClient';

export const metadata = {
  title: 'Strain Review Queue — Canopy Market',
};

export default function AdminStrainsPage() {
  return (
    <Suspense fallback={<div className="mx-auto max-w-4xl px-4 py-20 text-center text-canopy-muted">Loading…</div>}>
      <AdminStrainsClient />
    </Suspense>
  );
}
